package graphqlbackend

import (
	"context"
	"fmt"
	"regexp"
	"regexp/syntax"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/zoekt"
	zoektquery "github.com/google/zoekt/query"
	"github.com/inconshreveable/log15"
	otlog "github.com/opentracing/opentracing-go/log"
	"github.com/pkg/errors"
	"github.com/sourcegraph/sourcegraph/cmd/frontend/types"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/errcode"
	"github.com/sourcegraph/sourcegraph/internal/lazyregexp"
	"github.com/sourcegraph/sourcegraph/internal/search"
	querytypes "github.com/sourcegraph/sourcegraph/internal/search/query/types"
	"github.com/sourcegraph/sourcegraph/internal/trace"
)

var matchHoleRegexp = lazyregexp.New(splitOnHolesPattern())

func splitOnHolesPattern() string {
	word := `\w+`
	whitespaceAndOptionalWord := `[ ]+(` + word + `)?`
	holeAnything := `:\[` + word + `\]`
	holeAlphanum := `:\[\[` + word + `\]\]`
	holeWithPunctuation := `:\[` + word + `\.\]`
	holeWithNewline := `:\[` + word + `\\n\]`
	holeWhitespace := `:\[` + whitespaceAndOptionalWord + `\]`
	return strings.Join([]string{
		holeAnything,
		holeAlphanum,
		holeWithPunctuation,
		holeWithNewline,
		holeWhitespace,
	}, "|")
}

var matchRegexpPattern = lazyregexp.New(`(\w+)?~(.*)`)

type Term interface {
	term()
	String() string
}

type Literal string
type RegexpPattern string

func (Literal) term() {}
func (t Literal) String() string {
	return string(t)
}

func (RegexpPattern) term() {}
func (t RegexpPattern) String() string {
	return string(t)
}

// templateToRegexp parses a comby pattern to a list of Terms where a Term is
// either a literal or a regular expression extracted from hole syntax.
func templateToRegexp(buf []byte) []Term {
	// uses `open` to track whether [] are balanced when parsing hole syntax
	// and uses `inside` to track whether [] are balanced inside holes that
	// contain regular expressions
	var open, inside, advance int
	var r rune
	var currentLiteral, currentHole []rune
	var result []Term

	next := func() rune {
		r, advance := utf8.DecodeRune(buf)
		buf = buf[advance:]
		return r
	}

	for len(buf) > 0 {
		r = next()
		switch r {
		case ':':
			if len(buf[advance:]) > 0 {
				r = next()
				if r == '[' {
					open++
					result = append(result, Literal(currentLiteral))
					currentLiteral = []rune{}
					continue
				}
				currentLiteral = append(currentLiteral, ':', r)
				continue
			}
			currentLiteral = append(currentLiteral, ':')
		case '\\':
			if len(buf[advance:]) > 0 && open > 0 {
				// assume this is an escape sequence for a regex hole
				r = next()
				currentHole = append(currentHole, '\\', r)
				continue
			}
			currentLiteral = append(currentLiteral, '\\')
		case '[':
			if open > 0 {
				inside++
				currentHole = append(currentHole, '[')
				continue
			}
			currentLiteral = append(currentLiteral, r)
		case ']':
			if open > 0 && inside > 0 {
				inside--
				currentHole = append(currentHole, ']')
				continue
			}
			if open > 0 {
				if matchRegexpPattern.MatchString(string(currentHole)) {
					extractedRegexp := matchRegexpPattern.ReplaceAllString(string(currentHole), `$2`)
					currentHole = []rune{}
					result = append(result, RegexpPattern(extractedRegexp))
				}
				open--
				continue
			}
			currentLiteral = append(currentLiteral, r)
		default:
			if open > 0 {
				currentHole = append(currentHole, r)
			} else {
				currentLiteral = append(currentLiteral, r)
			}
		}
	}
	result = append(result, Literal(currentLiteral))
	return result
}

var onMatchWhitespace = lazyregexp.New(`[\s]+`)

// StructuralPatToRegexpQuery converts a comby pattern to an approximate regular
// expression query. It converts whitespace in the pattern so that content
// across newlines can be matched in the index. As an incomplete approximation,
// we use the regex pattern .*? to scan ahead. A shortcircuit option returns a
// regexp query that may find true matches faster, but may miss all possible
// matches.
//
// Example:
// "ParseInt(:[args]) if err != nil" -> "ParseInt(.*)\s+if\s+err!=\s+nil"
func StructuralPatToRegexpQuery(pattern string, shortcircuit bool) string {
	var pieces []string

	terms := templateToRegexp([]byte(pattern))
	for _, term := range terms {
		if term.String() == "" {
			continue
		}
		switch v := term.(type) {
		case Literal:
			piece := regexp.QuoteMeta(v.String())
			piece = onMatchWhitespace.ReplaceAllLiteralString(piece, `[\s]+`)
			pieces = append(pieces, piece)
		case RegexpPattern:
			pieces = append(pieces, v.String())
		default:
			panic("Unreachable")
		}
	}

	if len(pieces) == 0 {
		// Match anything.
		return "(.|\\s)*?"
	}

	if shortcircuit {
		// As a shortcircuit, do not match across newlines of structural search pieces.
		return "(" + strings.Join(pieces, ").*?(") + ")"
	}
	return "(" + strings.Join(pieces, ")(.|\\s)*?(") + ")"
}

func HandleFilePathPatterns(query *search.TextPatternInfo) (zoektquery.Q, error) {
	var and []zoektquery.Q

	// Zoekt uses regular expressions for file paths.
	// Unhandled cases: PathPatternsAreCaseSensitive and whitespace in file path patterns.
	for _, p := range query.IncludePatterns {
		q, err := fileRe(p, query.IsCaseSensitive)
		if err != nil {
			return nil, err
		}
		and = append(and, q)
	}
	if query.ExcludePattern != "" {
		q, err := fileRe(query.ExcludePattern, query.IsCaseSensitive)
		if err != nil {
			return nil, err
		}
		and = append(and, &zoektquery.Not{Child: q})
	}

	// For conditionals that happen on a repo we can use type:repo queries. eg
	// (type:repo file:foo) (type:repo file:bar) will match all repos which
	// contain a filename matching "foo" and a filename matchinb "bar".
	//
	// Note: (type:repo file:foo file:bar) will only find repos with a
	// filename containing both "foo" and "bar".
	for _, p := range query.FilePatternsReposMustInclude {
		q, err := fileRe(p, query.IsCaseSensitive)
		if err != nil {
			return nil, err
		}
		and = append(and, &zoektquery.Type{Type: zoektquery.TypeRepo, Child: q})
	}
	for _, p := range query.FilePatternsReposMustExclude {
		q, err := fileRe(p, query.IsCaseSensitive)
		if err != nil {
			return nil, err
		}
		and = append(and, &zoektquery.Not{Child: &zoektquery.Type{Type: zoektquery.TypeRepo, Child: q}})
	}

	return zoektquery.NewAnd(and...), nil
}

func buildQuery(args *search.TextParameters, repos *indexedRepoRevs, filePathPatterns zoektquery.Q, shortcircuit bool) (zoektquery.Q, error) {
	regexString := StructuralPatToRegexpQuery(args.PatternInfo.Pattern, shortcircuit)
	if len(regexString) == 0 {
		return &zoektquery.Const{Value: true}, nil
	}
	re, err := syntax.Parse(regexString, syntax.ClassNL|syntax.PerlX|syntax.UnicodeGroups)
	if err != nil {
		return nil, err
	}
	return zoektquery.NewAnd(
		&zoektquery.RepoBranches{Set: repos.repoBranches},
		filePathPatterns,
		&zoektquery.Regexp{
			Regexp:        re,
			CaseSensitive: true,
			Content:       true,
		},
	), nil
}

// zoektSearchHEADOnlyFiles searches repositories using zoekt, returning only the file paths containing
// content matching the given pattern.
//
// Timeouts are reported through the context, and as a special case errNoResultsInTimeout
// is returned if no results are found in the given timeout (instead of the more common
// case of finding partial or full results in the given timeout).
func zoektSearchHEADOnlyFiles(ctx context.Context, args *search.TextParameters, repos *indexedRepoRevs, since func(t time.Time) time.Duration) (fm []*FileMatchResolver, limitHit bool, reposLimitHit map[string]struct{}, err error) {
	if len(repos.repoRevs) == 0 {
		return nil, false, nil, nil
	}

	k := zoektResultCountFactor(len(repos.repoBranches), args.PatternInfo.FileMatchLimit, args.Mode == search.ZoektGlobalSearch)
	searchOpts := zoektSearchOpts(ctx, k, args.PatternInfo)

	if args.UseFullDeadline {
		// If the user manually specified a timeout, allow zoekt to use all of the remaining timeout.
		deadline, _ := ctx.Deadline()
		searchOpts.MaxWallTime = time.Until(deadline)

		// We don't want our context's deadline to cut off zoekt so that we can get the results
		// found before the deadline.
		//
		// We'll create a new context that gets cancelled if the other context is cancelled for any
		// reason other than the deadline being exceeded. This essentially means the deadline for the new context
		// will be `deadline + time for zoekt to cancel + network latency`.
		var cancel context.CancelFunc
		ctx, cancel = contextWithoutDeadline(ctx)
		defer cancel()
	}

	filePathPatterns, err := HandleFilePathPatterns(args.PatternInfo)
	if err != nil {
		return nil, false, nil, err
	}

	t0 := time.Now()
	q, err := buildQuery(args, repos, filePathPatterns, true)
	if err != nil {
		return nil, false, nil, err
	}
	resp, err := args.Zoekt.Client.Search(ctx, q, &searchOpts)
	if err != nil {
		return nil, false, nil, err
	}
	if since(t0) >= searchOpts.MaxWallTime {
		return nil, false, nil, errNoResultsInTimeout
	}

	// We always return approximate results (limitHit true) unless we run the branch to perform a more complete search.
	limitHit = true
	// If the previous indexed search did not return a substantial number of matching file candidates or count was
	// manually specified, run a more complete and expensive search.
	if resp.FileCount < 10 || args.PatternInfo.FileMatchLimit != defaultMaxSearchResults {
		q, err = buildQuery(args, repos, filePathPatterns, false)
		if err != nil {
			return nil, false, nil, err
		}
		resp, err = args.Zoekt.Client.Search(ctx, q, &searchOpts)
		if err != nil {
			return nil, false, nil, err
		}
		if since(t0) >= searchOpts.MaxWallTime {
			return nil, false, nil, errNoResultsInTimeout
		}
		// This is the only place limitHit can be set false, meaning we covered everything.
		limitHit = resp.FilesSkipped+resp.ShardsSkipped > 0
	}

	if len(resp.Files) == 0 {
		return nil, false, nil, nil
	}

	// Zoekt did not evaluate some files in repositories or ignored some repositories. Record skipped repos.
	reposLimitHit = make(map[string]struct{})
	if limitHit {
		for _, file := range resp.Files {
			if _, ok := reposLimitHit[file.Repository]; !ok {
				reposLimitHit[file.Repository] = struct{}{}
			}
		}
	}

	if fileMatchLimit := int(args.PatternInfo.FileMatchLimit); len(resp.Files) > fileMatchLimit {
		// Trim files based on count.
		fileMatchesInSkippedRepos := resp.Files[fileMatchLimit:]
		resp.Files = resp.Files[:fileMatchLimit]

		if !limitHit {
			// Record skipped repos with trimmed files.
			for _, file := range fileMatchesInSkippedRepos {
				if _, ok := reposLimitHit[file.Repository]; !ok {
					reposLimitHit[file.Repository] = struct{}{}
				}
			}
		}
		limitHit = true
	}

	maxLineMatches := 25 + k
	matches := make([]*FileMatchResolver, len(resp.Files))
	repoResolvers := make(RepositoryResolverCache)
	for i, file := range resp.Files {
		fileLimitHit := false
		if len(file.LineMatches) > maxLineMatches {
			file.LineMatches = file.LineMatches[:maxLineMatches]
			fileLimitHit = true
			limitHit = true
		}
		repoRev := repos.repoRevs[file.Repository]
		if repoResolvers[repoRev.Repo.Name] == nil {
			repoResolvers[repoRev.Repo.Name] = &RepositoryResolver{repo: repoRev.Repo}
		}
		matches[i] = &FileMatchResolver{
			JPath:     file.FileName,
			JLimitHit: fileLimitHit,
			uri:       fileMatchURI(repoRev.Repo.Name, "", file.FileName),
			Repo:      repoResolvers[repoRev.Repo.Name],
			CommitID:  api.CommitID(file.Version),
		}
	}

	return matches, limitHit, reposLimitHit, nil
}

func buildQueryReposOnly(args *search.TextParameters, repos *indexedRepoRevs, filePathPatterns zoektquery.Q, shortcircuit bool) (zoektquery.Q, error) {
	regexString := StructuralPatToRegexpQuery(args.PatternInfo.Pattern, shortcircuit)
	if len(regexString) == 0 {
		return &zoektquery.Const{Value: true}, nil
	}
	re, err := syntax.Parse(regexString, syntax.ClassNL|syntax.PerlX|syntax.UnicodeGroups)
	if err != nil {
		return nil, err
	}
	return zoektquery.NewAnd(
		&zoektquery.RepoBranches{Set: repos.repoBranches},
		filePathPatterns,
		&zoektquery.Type{
			Type: zoektquery.TypeRepo,
			Child: &zoektquery.Regexp{
				Regexp:        re,
				CaseSensitive: true,
				Content:       true,
			},
		}), nil
}

func successRepos(ctx context.Context, args *search.TextParameters, repos *indexedRepoRevs) (*zoekt.SearchResult, error) {
	filePathPatterns, err := HandleFilePathPatterns(args.PatternInfo)
	if err != nil {
		return nil, err
	}
	q, err := buildQueryReposOnly(args, repos, filePathPatterns, true)
	if err != nil {
		return nil, err
	}
	successRepos, err := args.Zoekt.Client.Search(ctx, q, &zoekt.SearchOptions{
		ShardMaxMatchCount: 1,
		TotalMaxMatchCount: 1,
	})
	if err != nil {
		return nil, err
	}
	return successRepos, nil
}

// get repos from Zoekt with its regex search. In all other cases, call out to searcher.
func searchFilesInReposStructural(ctx context.Context, args *search.TextParameters) (res []*FileMatchResolver, common *searchResultsCommon, err error) {
	if mockSearchFilesInRepos != nil {
		return mockSearchFilesInRepos(args)
	}

	tr, ctx := trace.New(ctx, "searchFilesInReposStructural", fmt.Sprintf("query: %s", args.PatternInfo.Pattern))
	defer func() {
		tr.SetError(err)
		tr.Finish()
	}()
	fields := querytypes.Fields(args.Query.Fields())
	tr.LogFields(
		trace.Stringer("query", &fields),
		trace.Stringer("info", args.PatternInfo),
	)

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	common = &searchResultsCommon{partial: make(map[api.RepoName]struct{})}

	indexed, err := newIndexedSearchRequest(ctx, args, textRequest)
	if err != nil {
		return nil, nil, err
	}

	tr.LazyPrintf("%d indexed repos, %d unindexed repos", len(indexed.Repos()), len(indexed.Unindexed))

	matchingIndexedRepos, err := successRepos(ctx, args, indexed.repos)
	if err != nil {
		return nil, nil, err
	}

	var searcherRepos []*search.RepositoryRevisions
	if indexed.DisableUnindexedSearch {
		tr.LazyPrintf("disabling unindexed search")
		common.missing = make([]*types.Repo, len(indexed.Unindexed))
		for i, r := range indexed.Unindexed {
			common.missing[i] = r.Repo
		}
	} else {
		// Limit the number of unindexed repositories searched for a single
		// query. Searching more than this will merely flood the system and
		// network with requests that will timeout.
		searcherRepos, common.missing = limitSearcherRepos(indexed.Unindexed, maxUnindexedRepoRevSearchesPerQuery)
		if len(common.missing) > 0 {
			tr.LazyPrintf("limiting unindexed repos searched to %d", maxUnindexedRepoRevSearchesPerQuery)
		}
	}

	var (
		wg                sync.WaitGroup
		mu                sync.Mutex
		searchErr         error
		unflattened       [][]*FileMatchResolver
		flattenedSize     int
		overLimitCanceled bool
	)

	// addMatches assumes the caller holds mu.
	addMatches := func(matches []*FileMatchResolver) {
		if len(matches) > 0 {
			common.resultCount += int32(len(matches))
			sort.Slice(matches, func(i, j int) bool {
				a, b := matches[i].uri, matches[j].uri
				return a > b
			})
			unflattened = append(unflattened, matches)
			flattenedSize += len(matches)

			// Stop searching once we have found enough matches. This does
			// lead to potentially unstable result ordering, but is worth
			// it for the performance benefit.
			if flattenedSize > int(args.PatternInfo.FileMatchLimit) {
				tr.LazyPrintf("cancel due to result size: %d > %d", flattenedSize, args.PatternInfo.FileMatchLimit)
				overLimitCanceled = true
				common.limitHit = true
				cancel()
			}
		}
	}

	// This function calls searcher on a set of repos.
	callSearcherOverRepos := func(searcherRepos []*search.RepositoryRevisions) error {
		var fetchTimeout time.Duration
		if len(searcherRepos) == 1 || args.UseFullDeadline {
			// When searching a single repo or when an explicit timeout was specified, give it the remaining deadline to fetch the archive.
			deadline, ok := ctx.Deadline()
			if ok {
				fetchTimeout = time.Until(deadline)
			} else {
				// In practice, this case should not happen because a deadline should always be set
				// but if it does happen just set a long but finite timeout.
				fetchTimeout = time.Minute
			}
		} else {
			// When searching many repos, don't wait long for any single repo to fetch.
			fetchTimeout = 500 * time.Millisecond
		}

		if len(searcherRepos) > 0 {
			// The number of searcher endpoints can change over time. Inform our
			// limiter of the new limit, which is a multiple of the number of
			// searchers.
			eps, err := args.SearcherURLs.Endpoints()
			if err != nil {
				return err
			}
			textSearchLimiter.SetLimit(len(eps) * 32)
		}

	outer:
		for _, repoAllRevs := range searcherRepos {
			if len(repoAllRevs.Revs) == 0 {
				continue
			}

			revSpecs, err := repoAllRevs.ExpandedRevSpecs(ctx)
			if err != nil {
				return err
			}

			for _, rev := range revSpecs {
				// Only reason acquire can fail is if ctx is cancelled. So we can stop
				// looping through searcherRepos.
				limitCtx, limitDone, acquireErr := textSearchLimiter.Acquire(ctx)
				if acquireErr != nil {
					break outer
				}

				// Make a new repoRev for just the operation of searching this revspec.
				repoRev := &search.RepositoryRevisions{Repo: repoAllRevs.Repo, Revs: []search.RevisionSpecifier{{RevSpec: rev}}}

				wg.Add(1)
				go func(ctx context.Context, done context.CancelFunc) {
					defer wg.Done()
					defer done()

					matches, repoLimitHit, err := searchFilesInRepo(ctx, args.SearcherURLs, repoRev.Repo, repoRev.GitserverRepo(), repoRev.RevSpecs()[0], args.PatternInfo, fetchTimeout)
					if err != nil {
						tr.LogFields(otlog.String("repo", string(repoRev.Repo.Name)), otlog.Error(err), otlog.Bool("timeout", errcode.IsTimeout(err)), otlog.Bool("temporary", errcode.IsTemporary(err)))
						log15.Warn("searchFilesInRepo failed", "error", err, "repo", repoRev.Repo.Name)
					}
					mu.Lock()
					defer mu.Unlock()
					if ctx.Err() == nil {
						common.searched = append(common.searched, repoRev.Repo)
					}
					if repoLimitHit {
						// We did not return all results in this repository.
						common.partial[repoRev.Repo.Name] = struct{}{}
					}
					// non-diff search reports timeout through err, so pass false for timedOut
					if fatalErr := handleRepoSearchResult(common, repoRev, repoLimitHit, false, err); fatalErr != nil {
						if ctx.Err() == context.Canceled {
							// Our request has been canceled (either because another one of searcherRepos
							// had a fatal error, or otherwise), so we can just ignore these results. We
							// handle this here, not in handleRepoSearchResult, because different callers of
							// handleRepoSearchResult (for different result types) currently all need to
							// handle cancellations differently.
							return
						}
						if searchErr == nil {
							searchErr = errors.Wrapf(err, "failed to search %s", repoRev.String())
							tr.LazyPrintf("cancel due to error: %v", searchErr)
							cancel()
						}
					}
					addMatches(matches)
				}(limitCtx, limitDone) // ends the Go routine for a call to searcher for a repo
			} // ends the for loop iterating over repo's revs
		} // ends the for loop iterating over repos
		return nil
	} // ends callSearcherOverRepos

	for repo, _ := range matchingIndexedRepos.RepoURLs {
		log15.Info("indexed", "repo", repo)
		// Just doing this: https://sourcegraph.com/github.com/sourcegraph/sourcegraph/-/blob/cmd/frontend/graphqlbackend/search_structural.go#L347. I don't understand why it is this way.
		searcherRepos = append(searcherRepos, indexed.repos.repoRevs[repo])
	}
	if err := callSearcherOverRepos(searcherRepos); err != nil {
		mu.Lock()
		searchErr = err
		mu.Unlock()
	}

	wg.Wait()
	if searchErr != nil {
		return nil, common, searchErr
	}

	repos, err := getRepos(ctx, args.RepoPromise)
	if err != nil {
		return nil, common, err
	}
	common.repos = make([]*types.Repo, len(repos))
	for i, repo := range repos {
		common.repos[i] = repo.Repo
	}

	flattened := flattenFileMatches(unflattened, int(args.PatternInfo.FileMatchLimit))
	return flattened, common, nil
}
