package zoekt

import (
	"context"
	"time"
	"unicode/utf8"

	"github.com/cockroachdb/errors"
	"github.com/google/zoekt"
	zoektquery "github.com/google/zoekt/query"
	"github.com/opentracing/opentracing-go/log"
	"go.uber.org/atomic"

	"github.com/sourcegraph/sourcegraph/internal/actor"
	"github.com/sourcegraph/sourcegraph/internal/api"
	"github.com/sourcegraph/sourcegraph/internal/search"
	"github.com/sourcegraph/sourcegraph/internal/search/backend"
	"github.com/sourcegraph/sourcegraph/internal/search/filter"
	"github.com/sourcegraph/sourcegraph/internal/search/query"
	"github.com/sourcegraph/sourcegraph/internal/search/result"
	"github.com/sourcegraph/sourcegraph/internal/search/streaming"
	"github.com/sourcegraph/sourcegraph/internal/trace"
	"github.com/sourcegraph/sourcegraph/internal/types"
)

// IndexedSearchRequest exposes a method Search(...) to search over indexed
// repositories. Two kinds of indexed searches implement it:
// (1) IndexedUniverseSearchRequest that searches over the universe of indexed repositories.
// (2) IndexedSubsetSearchRequest that searches over an indexed subset of repos in the universe of indexed repositories.
type IndexedSearchRequest interface {
	Search(context.Context, streaming.Sender) error
}

func NewIndexedSearchRequest(ctx context.Context, args *search.TextParameters, typ search.IndexedRequestType, onMissing OnMissingRepos) (IndexedSearchRequest, error) {
	if args.Mode == search.ZoektGlobalSearch {
		// performance: optimize global searches where Zoekt searches
		// all shards anyway.
		return NewIndexedUniverseSearchRequest(ctx, args, typ, args.RepoOptions, args.Repos.Private)
	}
	return NewIndexedSubsetSearchRequest(ctx, args, typ, onMissing)
}

// IndexedUniverseSearchRequest represents a request to run a search over the universe of indexed repositories.
type IndexedUniverseSearchRequest struct {
	RepoOptions      search.RepoOptions
	UserPrivateRepos *types.RepoSet
	Args             *search.ZoektParameters
}

func (s *IndexedUniverseSearchRequest) Search(ctx context.Context, c streaming.Sender) error {
	if s.Args == nil {
		return nil
	}

	q := zoektGlobalQuery(s.Args.Query, s.RepoOptions, s.UserPrivateRepos)
	return doZoektSearchGlobal(ctx, q, s.Args.Typ, s.Args.Zoekt.Client, s.Args.FileMatchLimit, s.Args.Select, c)
}

func NewIndexedUniverseSearchRequest(ctx context.Context, args *search.TextParameters, typ search.IndexedRequestType, repoOptions search.RepoOptions, userPrivateRepos *types.RepoSet) (_ *IndexedUniverseSearchRequest, err error) {
	tr, _ := trace.New(ctx, "NewIndexedUniverseSearchRequest", "text")
	defer func() {
		tr.SetError(err)
		tr.Finish()
	}()

	q, err := search.QueryToZoektQuery(args.PatternInfo, typ == search.SymbolRequest)
	if err != nil {
		return nil, err
	}

	return &IndexedUniverseSearchRequest{
		RepoOptions:      repoOptions,
		UserPrivateRepos: userPrivateRepos,
		Args: &search.ZoektParameters{
			Query:          q,
			Typ:            typ,
			FileMatchLimit: args.PatternInfo.FileMatchLimit,
			Select:         args.PatternInfo.Select,
			Zoekt:          args.Zoekt,
		},
	}, nil
}

// IndexedSubsetSearchRequest is responsible for:
// (1) partitioning repos into indexed and unindexed sets of repos to search.
//     These sets are a subset of the universe of repos.
// (2) providing a method Search(...) that runs Zoekt over the indexed set of
//     repositories.
type IndexedSubsetSearchRequest struct {
	// Repos is the set of repos to be searched. Only repos in IndexedRepoRevs
	// will be searched in Zoekt, everything else will be searched in searcher.
	Repos *search.Repos

	// MaxUnindexed determines the maximum number of searcher queries.
	MaxUnindexed int

	// OnMissing is called for the unindexed repos that weren't searched.
	OnMissing OnMissingRepos

	// Inputs
	Args *search.ZoektParameters

	// since if non-nil will be used instead of time.Since. For tests
	since func(time.Time) time.Duration
}

// Search streams 0 or more events to c.
func (s *IndexedSubsetSearchRequest) Search(ctx context.Context, c streaming.Sender) error {
	if s.Args == nil {
		return nil
	}

	since := time.Since
	if s.since != nil {
		since = s.since
	}

	return zoektSearch(ctx, s.Repos, s.Args.Query, s.Args.Typ, s.Args.Zoekt.Client, s.Args.FileMatchLimit, s.Args.Select, since, c)
}

const maxUnindexedRepoRevSearchesPerQuery = 200

type OnMissingRepos func(*search.Repos)

func MissingRepoRevStatus(stream streaming.Sender) OnMissingRepos {
	return func(repos *search.Repos) {
		var status search.RepoStatusMap
		repos.ForEach(func(r *types.RepoName) error {
			status.Update(r.ID, search.RepoStatusMissing)
			return nil
		})
		stream.Send(streaming.SearchEvent{
			Stats: streaming.Stats{
				Status: status,
			},
		})
	}
}

func NewIndexedSubsetSearchRequest(ctx context.Context, args *search.TextParameters, typ search.IndexedRequestType, onMissing OnMissingRepos) (_ *IndexedSubsetSearchRequest, err error) {
	tr, ctx := trace.New(ctx, "NewIndexedSubsetSearchRequest", string(typ))
	tr.LogFields(trace.Stringer("global_search_mode", args.Mode))
	defer func() {
		tr.SetError(err)
		tr.Finish()
	}()

	req := &IndexedSubsetSearchRequest{
		Repos:        args.Repos,
		MaxUnindexed: maxUnindexedRepoRevSearchesPerQuery,
		OnMissing:    onMissing,
	}

	// If Zoekt is disabled just fallback to Unindexed.
	if !args.Zoekt.Enabled() {
		if args.PatternInfo.Index == query.Only {
			return nil, errors.Errorf("invalid index:%q (indexed search is not enabled)", args.PatternInfo.Index)
		}
		return req, nil
	}

	// Fallback to Unindexed if the query contains ref-globs
	if query.ContainsRefGlobs(args.Query) {
		if args.PatternInfo.Index == query.Only {
			return nil, errors.Errorf("invalid index:%q (revsions with glob pattern cannot be resolved for indexed searches)", args.PatternInfo.Index)
		}
		return req, nil
	}

	// Fallback to Unindexed if index:no
	if args.PatternInfo.Index == query.No {
		return req, nil
	}

	tr.LogFields(
		log.Int("indexed.size", len(args.Repos.IndexedRepoRevs)),
		log.Int("searcher_repos.size", len(args.Repos.RepoRevs)-len(args.Repos.IndexedRepoRevs)),
	)

	if len(args.Repos.RepoRevs) > len(args.Repos.IndexedRepoRevs) {
		if args.PatternInfo.Index == query.Only {
			return nil, errors.New("index:only failed since indexed search is not available yet")
		}
		return req, nil
	}

	// Disable unindexed search
	if args.PatternInfo.Index == query.Only {
		req.MaxUnindexed = 0
		return req, nil
	}

	q, err := search.QueryToZoektQuery(args.PatternInfo, typ == search.SymbolRequest)
	if err != nil {
		return nil, err
	}

	req.Args = &search.ZoektParameters{
		Query:          q,
		Typ:            typ,
		FileMatchLimit: args.PatternInfo.FileMatchLimit,
		Select:         args.PatternInfo.Select,
		Zoekt:          args.Zoekt,
	}

	return req, nil
}

// zoektGlobalQuery constructs a query that searches the entire universe of indexed repositories.
//
// We construct 2 Zoekt queries. One query for public repos and one query for
// private repos.
//
// We only have to search "HEAD", because global queries, per definition, don't
// have a repo: filter and consequently no rev: filter. This makes the code a bit
// simpler because we don't have to resolve revisions before sending off (global)
// requests to Zoekt.
func zoektGlobalQuery(q zoektquery.Q, repoOptions search.RepoOptions, userPrivateRepos *types.RepoSet) zoektquery.Q {
	var qs []zoektquery.Q

	// Public or Any
	if repoOptions.Visibility == query.Public || repoOptions.Visibility == query.Any {
		rc := zoektquery.RcOnlyPublic
		apply := func(f zoektquery.RawConfig, b bool) {
			if !b {
				return
			}
			rc |= f
		}
		apply(zoektquery.RcOnlyArchived, repoOptions.OnlyArchived)
		apply(zoektquery.RcNoArchived, repoOptions.NoArchived)
		apply(zoektquery.RcOnlyForks, repoOptions.OnlyForks)
		apply(zoektquery.RcNoForks, repoOptions.NoForks)

		qs = append(qs, zoektquery.NewAnd(&zoektquery.Branch{Pattern: "HEAD", Exact: true}, rc, q))
	}

	// Private or Any
	if (repoOptions.Visibility == query.Private || repoOptions.Visibility == query.Any) && userPrivateRepos.Len() > 0 {
		privateRepoSet := make(map[string][]string, userPrivateRepos.Len())
		head := []string{"HEAD"}
		for _, r := range userPrivateRepos.Repos {
			privateRepoSet[string(r.Name)] = head
		}
		qs = append(qs, zoektquery.NewAnd(&zoektquery.RepoBranches{Set: privateRepoSet}, q))
	}

	return zoektquery.Simplify(zoektquery.NewOr(qs...))
}

func doZoektSearchGlobal(ctx context.Context, q zoektquery.Q, typ search.IndexedRequestType, client zoekt.Streamer, fileMatchLimit int32, selector filter.SelectPath, c streaming.Sender) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	k := ResultCountFactor(0, fileMatchLimit, true)
	searchOpts := SearchOpts(ctx, k, fileMatchLimit)

	if deadline, ok := ctx.Deadline(); ok {
		// If the user manually specified a timeout, allow zoekt to use all of the remaining timeout.
		searchOpts.MaxWallTime = time.Until(deadline)
		if searchOpts.MaxWallTime < 0 {
			return ctx.Err()
		}
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

	// PERF: if we are going to be selecting to repo results only anyways, we can
	// just ask zoekt for only results of type repo.
	if selector.Root() == filter.Repository {
		repoList, err := client.List(ctx, q, nil)
		if err != nil {
			return err
		}

		matches := make([]result.Match, 0, len(repoList.Repos))
		for _, repo := range repoList.Repos {
			matches = append(matches, &result.RepoMatch{
				Name: api.RepoName(repo.Repository.Name),
				ID:   api.RepoID(repo.Repository.ID),
			})
		}

		c.Send(streaming.SearchEvent{
			Results: matches,
			Stats:   streaming.Stats{}, // TODO
		})
		return nil
	}

	return client.StreamSearch(ctx, q, &searchOpts, backend.ZoektStreamFunc(func(event *zoekt.SearchResult) {
		sendMatches(event, typ, c, func(file *zoekt.FileMatch) (*types.RepoName, []string) {
			repo := &types.RepoName{
				ID:   api.RepoID(file.RepositoryID),
				Name: api.RepoName(file.Repository),
			}
			return repo, []string{""}
		})
	}))
}

// zoektSearch searches repositories using zoekt. It only gets called for non-global searches, which specify at least
// one explicit repo:r@rev or (repo:r rev:rev) filters.
func zoektSearch(ctx context.Context, repos *search.Repos, q zoektquery.Q, typ search.IndexedRequestType, client zoekt.Streamer, fileMatchLimit int32, selector filter.SelectPath, since func(t time.Time) time.Duration, c streaming.Sender) error {
	if len(repos.IndexedBranches) == 0 {
		return nil
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	finalQuery := zoektquery.NewAnd(&zoektquery.RepoBranches{Set: repos.IndexedBranches}, q)

	k := ResultCountFactor(len(repos.IndexedBranches), fileMatchLimit, false)
	searchOpts := SearchOpts(ctx, k, fileMatchLimit)

	// Start event stream.
	t0 := time.Now()

	if deadline, ok := ctx.Deadline(); ok {
		// If the user manually specified a timeout, allow zoekt to use all of the remaining timeout.
		searchOpts.MaxWallTime = time.Until(deadline)
		if searchOpts.MaxWallTime < 0 {
			return ctx.Err()
		}
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

	// PERF: if we are going to be selecting to repo results only anyways, we can just ask
	// zoekt for only results of type repo.
	if selector.Root() == filter.Repository {
		return zoektSearchReposOnly(ctx, client, finalQuery, c, repos)
	}

	foundResults := atomic.Bool{}
	err := client.StreamSearch(ctx, finalQuery, &searchOpts, backend.ZoektStreamFunc(func(event *zoekt.SearchResult) {
		foundResults.CAS(false, event.FileCount != 0 || event.MatchCount != 0)
		sendMatches(event, typ, c, func(file *zoekt.FileMatch) (repo *types.RepoName, inputRevs []string) {
			revs := repos.IndexedRepoRevs[api.RepoName(file.Repository)]
			inputRevs = make([]string, 0, len(file.Branches))
			for _, branch := range file.Branches {
				for i, b := range repos.IndexedBranches[file.Repository] {
					if branch == b {
						// RevSpec is guaranteed to be explicit via zoektIndexedRepos
						inputRevs = append(inputRevs, revs[i].RevSpec)
					}
				}
			}

			if len(inputRevs) == 0 {
				// Did not find a match. This is unexpected, but we can fallback to
				// file.Version to generate correct links.
				inputRevs = append(inputRevs, file.Version)
			}

			return repos.GetByName(api.RepoName(file.Repository)), inputRevs
		})
	}))
	if err != nil {
		return err
	}

	mkStatusMap := func(mask search.RepoStatus) search.RepoStatusMap {
		var statusMap search.RepoStatusMap
		repos.ForEach(func(r *types.RepoName) error {
			statusMap.Update(r.ID, mask)
			return nil
		})
		return statusMap
	}

	if !foundResults.Load() && since(t0) >= searchOpts.MaxWallTime {
		c.Send(streaming.SearchEvent{Stats: streaming.Stats{Status: mkStatusMap(search.RepoStatusTimedout)}})
	}
	return nil
}

func sendMatches(event *zoekt.SearchResult, typ search.IndexedRequestType, c streaming.Sender, getRepoInputRev repoRevFunc) {
	files := event.Files
	limitHit := event.FilesSkipped+event.ShardsSkipped > 0

	if len(files) == 0 {
		c.Send(streaming.SearchEvent{
			Stats: streaming.Stats{IsLimitHit: limitHit},
		})
		return
	}

	matches := make([]result.Match, 0, len(files))
	for _, file := range files {
		repo, inputRevs := getRepoInputRev(&file)

		var lines []*result.LineMatch
		if typ != search.SymbolRequest {
			lines = zoektFileMatchToLineMatches(&file)
		}

		for _, inputRev := range inputRevs {
			inputRev := inputRev // copy so we can take the pointer

			var symbols []*result.SymbolMatch
			if typ == search.SymbolRequest {
				symbols = zoektFileMatchToSymbolResults(repo, inputRev, &file)
			}
			fm := result.FileMatch{
				LineMatches: lines,
				Symbols:     symbols,
				File: result.File{
					InputRev: &inputRev,
					CommitID: api.CommitID(file.Version),
					Repo:     repo,
					Path:     file.FileName,
				},
			}
			matches = append(matches, &fm)
		}
	}

	c.Send(streaming.SearchEvent{
		Results: matches,
		Stats: streaming.Stats{
			IsLimitHit: limitHit,
		},
	})
}

// zoektSearchReposOnly is used when select:repo is set, in which case we can ask zoekt
// only for the repos that contain matches for the query. This is a performance optimization,
// and not required for proper function of select:repo.
func zoektSearchReposOnly(ctx context.Context, client zoekt.Streamer, query zoektquery.Q, c streaming.Sender, repos *search.Repos) error {
	repoList, err := client.List(ctx, query, &zoekt.ListOptions{Minimal: true})
	if err != nil {
		return err
	}

	matches := make([]result.Match, 0, len(repoList.Minimal))
	for id := range repoList.Minimal {
		r := repos.GetByID(api.RepoID(id))
		if r == nil {
			continue
		}

		matches = append(matches, &result.RepoMatch{
			Name: r.Name,
			ID:   r.ID,
		})
	}

	c.Send(streaming.SearchEvent{
		Results: matches,
		Stats:   streaming.Stats{}, // TODO
	})
	return nil
}

func zoektFileMatchToLineMatches(file *zoekt.FileMatch) []*result.LineMatch {
	lines := make([]*result.LineMatch, 0, len(file.LineMatches))

	for _, l := range file.LineMatches {
		if l.FileName {
			continue
		}

		offsets := make([][2]int32, len(l.LineFragments))
		for k, m := range l.LineFragments {
			offset := utf8.RuneCount(l.Line[:m.LineOffset])
			length := utf8.RuneCount(l.Line[m.LineOffset : m.LineOffset+m.MatchLength])
			offsets[k] = [2]int32{int32(offset), int32(length)}
		}
		lines = append(lines, &result.LineMatch{
			Preview:          string(l.Line),
			LineNumber:       int32(l.LineNumber - 1),
			OffsetAndLengths: offsets,
		})
	}

	return lines
}

func zoektFileMatchToSymbolResults(repoName *types.RepoName, inputRev string, file *zoekt.FileMatch) []*result.SymbolMatch {
	newFile := &result.File{
		Path:     file.FileName,
		Repo:     repoName,
		CommitID: api.CommitID(file.Version),
		InputRev: &inputRev,
	}

	symbols := make([]*result.SymbolMatch, 0, len(file.LineMatches))
	for _, l := range file.LineMatches {
		if l.FileName {
			continue
		}

		for _, m := range l.LineFragments {
			if m.SymbolInfo == nil {
				continue
			}

			symbols = append(symbols, result.NewSymbolMatch(
				newFile,
				l.LineNumber,
				m.SymbolInfo.Sym,
				m.SymbolInfo.Kind,
				m.SymbolInfo.Parent,
				m.SymbolInfo.ParentKind,
				file.Language,
				string(l.Line),
				false,
			))
		}
	}

	return symbols
}

// contextWithoutDeadline returns a context which will cancel if the cOld is
// canceled.
func contextWithoutDeadline(cOld context.Context) (context.Context, context.CancelFunc) {
	cNew, cancel := context.WithCancel(context.Background())

	// Set trace context so we still get spans propagated
	cNew = trace.CopyContext(cNew, cOld)

	// Copy actor from cOld to cNew.
	cNew = actor.WithActor(cNew, actor.FromContext(cOld))

	go func() {
		select {
		case <-cOld.Done():
			// cancel the new context if the old one is done for some reason other than the deadline passing.
			if cOld.Err() != context.DeadlineExceeded {
				cancel()
			}
		case <-cNew.Done():
		}
	}()

	return cNew, cancel
}
