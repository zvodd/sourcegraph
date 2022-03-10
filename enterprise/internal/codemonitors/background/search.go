package background

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"hash/fnv"
	"net/http"
	"net/url"

	"github.com/graphql-go/graphql/gqlerrors"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/log"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/envvar"
	edb "github.com/sourcegraph/sourcegraph/enterprise/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/actor"
	"github.com/sourcegraph/sourcegraph/internal/api/internalapi"
	"github.com/sourcegraph/sourcegraph/internal/database"
	gitprotocol "github.com/sourcegraph/sourcegraph/internal/gitserver/protocol"
	"github.com/sourcegraph/sourcegraph/internal/httpcli"
	"github.com/sourcegraph/sourcegraph/internal/search"
	"github.com/sourcegraph/sourcegraph/internal/search/client"
	"github.com/sourcegraph/sourcegraph/internal/search/commit"
	"github.com/sourcegraph/sourcegraph/internal/search/job"
	"github.com/sourcegraph/sourcegraph/internal/search/predicate"
	"github.com/sourcegraph/sourcegraph/internal/search/result"
	"github.com/sourcegraph/sourcegraph/internal/search/run"
	"github.com/sourcegraph/sourcegraph/internal/search/streaming"
	"github.com/sourcegraph/sourcegraph/internal/search/structural"
	"github.com/sourcegraph/sourcegraph/internal/search/symbol"
	"github.com/sourcegraph/sourcegraph/internal/search/textsearch"
	"github.com/sourcegraph/sourcegraph/lib/errors"
	"github.com/sourcegraph/sourcegraph/schema"
)

const gqlSettingsQuery = `query CodeMonitorSettings{
	viewerSettings {
		final	
	}
}`

type gqlSettingsResponse struct {
	Data struct {
		ViewerSettings struct {
			Final string `json:"final"`
		} `json:"viewerSettings"`
	} `json:"data"`
	Errors []gqlerrors.FormattedError
}

// settings queries for the computed settings for the current actor
func settings(ctx context.Context) (_ *schema.Settings, err error) {
	span, ctx := opentracing.StartSpanFromContext(ctx, "CodeMonitorSearch")
	defer func() {
		span.LogFields(log.Error(err))
		span.Finish()
	}()

	reqBody, err := json.Marshal(map[string]interface{}{"query": gqlSettingsQuery})
	if err != nil {
		return nil, errors.Wrap(err, "marshal request body")
	}

	url, err := gqlURL("CodeMonitorSettings")
	if err != nil {
		return nil, errors.Wrap(err, "construct frontend URL")
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, errors.Wrap(err, "construct request")
	}
	req.Header.Set("Content-Type", "application/json")
	if span != nil {
		carrier := opentracing.HTTPHeadersCarrier(req.Header)
		span.Tracer().Inject(
			span.Context(),
			opentracing.HTTPHeaders,
			carrier,
		)
	}

	resp, err := httpcli.InternalDoer.Do(req.WithContext(ctx))
	if err != nil {
		return nil, errors.Wrap(err, "do request")
	}
	defer resp.Body.Close()

	var res gqlSettingsResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, errors.Wrap(err, "decode response")
	}

	if len(res.Errors) > 0 {
		var combined error
		for _, err := range res.Errors {
			combined = errors.Append(combined, err)
		}
		return nil, combined
	}

	var unmarshaledSettings schema.Settings
	if err := json.Unmarshal([]byte(res.Data.ViewerSettings.Final), &unmarshaledSettings); err != nil {
		return nil, err
	}
	return &unmarshaledSettings, nil
}

func doSearch(ctx context.Context, db database.DB, query string, monitorID int64, settings *schema.Settings) (_ []*result.CommitMatch, err error) {
	searchClient := client.NewSearchClient(db, search.Indexed(), search.SearcherURLs())
	inputs, err := searchClient.Plan(ctx, "V2", nil, query, search.Streaming, settings, envvar.SourcegraphDotComMode())
	if err != nil {
		return nil, err
	}

	// Inline job creation so we can mutate the commit job before running it
	jobArgs := searchClient.JobArgs(inputs)
	plan, err := predicate.Expand(ctx, db, jobArgs, inputs.Plan)
	if err != nil {
		return nil, err
	}

	planJob, err := job.FromExpandedPlan(jobArgs, plan)
	if err != nil {
		return nil, err
	}

	// If repo-aware monitors is enabled, mutate the job
	actor := actor.FromContext(ctx)
	ffs, err := db.FeatureFlags().GetUserFlags(ctx, actor.UID)
	if err != nil {
		return nil, err
	}
	if enabled, ok := ffs["cc-repo-aware-monitors"]; ok && enabled {
		planJob, err = addCodeMonitorHook(planJob, monitorID)
		if err != nil {
			return nil, err
		}
	}

	// Execute the search
	agg := streaming.NewAggregatingStream()
	_, err = planJob.Run(ctx, db, agg)
	if err != nil {
		return nil, err
	}

	// Assert that all results are commit matched
	results := make([]*result.CommitMatch, len(agg.Results))
	for i, res := range agg.Results {
		cm, ok := res.(*result.CommitMatch)
		if !ok {
			return nil, errors.Errorf("expected search to only return commit matches, but got type %T", res)
		}
		results[i] = cm
	}

	return results, nil
}

func addCodeMonitorHook(in job.Job, monitorID int64) (_ job.Job, err error) {
	addErr := func(j interface{}) {
		err = errors.Append(err, errors.Errorf("found invalid leaf job %T", j))
	}

	mapper := job.Mapper{
		// Error on any leaf nodes that aren't commit/diff searches
		MapRepoSearchJob:               func(j *run.RepoSearch) *run.RepoSearch { addErr(j); return nil },
		MapRepoSubsetTextSearchJob:     func(j *textsearch.RepoSubsetTextSearch) *textsearch.RepoSubsetTextSearch { addErr(j); return nil },
		MapRepoUniverseTextSearchJob:   func(j *textsearch.RepoUniverseTextSearch) *textsearch.RepoUniverseTextSearch { addErr(j); return nil },
		MapStructuralSearchJob:         func(j *structural.StructuralSearch) *structural.StructuralSearch { addErr(j); return nil },
		MapRepoSubsetSymbolSearchJob:   func(j *symbol.RepoSubsetSymbolSearch) *symbol.RepoSubsetSymbolSearch { addErr(j); return nil },
		MapRepoUniverseSymbolSearchJob: func(j *symbol.RepoUniverseSymbolSearch) *symbol.RepoUniverseSymbolSearch { addErr(j); return nil },

		MapCommitSearchJob: func(c *commit.CommitSearch) *commit.CommitSearch {
			jobCopy := *c
			jobCopy.CodeMonitorHook = codeMonitorHook(monitorID)
			return &jobCopy
		},
	}

	return mapper.Map(in), err
}

func codeMonitorHookWithID(monitorID int64) commit.CodeMonitorHookFunc {
	return func(
		ctx context.Context,
		db database.DB,
		gs commit.GitserverClient,
		doSearch commit.DoSearchFunc,
	) commit.DoSearchFunc {
		return func(args *gitprotocol.SearchRequest) error {
			db := edb.NewEnterpriseDB(db)
			argsHash := hashArgs(args)

			// Look up the previously searched set of commit hashes
			lastSearched, err := db.CodeMonitors().GetLastSearched(ctx, monitorID, argsHash)
			if err != nil {
				return err
			}

			// Resolve the requested revisions into a static set of commit hashes
			commitHashes, err := gs.ResolveRevisions(ctx, args.Repo, args.Revisions)
			if err != nil {
				return err
			}

			// Merge requested hashes and excluded hashes
			newRevs := make([]gitprotocol.RevisionSpecifier, 0, len(commitHashes)+len(lastSearched))
			for _, hash := range commitHashes {
				newRevs = append(newRevs, gitprotocol.RevisionSpecifier{RevSpec: hash})
			}
			for _, exclude := range lastSearched {
				newRevs = append(newRevs, gitprotocol.RevisionSpecifier{RevSpec: "^" + exclude})
			}

			// Update args with the new set of revisions
			argsCopy := *args
			argsCopy.Revisions = newRevs

			// Execute the search
			err = doSearch(&argsCopy)
			if err != nil {
				return err
			}

			// If the search was successful, store the resolved hashes
			// as the new "last searched" hashes
			return db.CodeMonitors().UpsertLastSearched(ctx, monitorID, argsHash, commitHashes)
		}
	}
}

func hashArgs(args *gitprotocol.SearchRequest) uint64 {
	hasher := fnv.New64()
	hasher.Write([]byte(args.Repo))
	for _, rev := range args.Revisions {
		hasher.Write([]byte(rev.RevSpec))
		hasher.Write([]byte{'|'})
		hasher.Write([]byte(rev.RefGlob))
		hasher.Write([]byte{'|'})
		hasher.Write([]byte(rev.ExcludeRefGlob))
	}
	hasher.Write([]byte(args.Query.String()))
	binary.Write(hasher, binary.LittleEndian, args.IncludeDiff)
	return hasher.Sum64()
}

func gqlURL(queryName string) (string, error) {
	u, err := url.Parse(internalapi.Client.URL)
	if err != nil {
		return "", err
	}
	u.Path = "/.internal/graphql"
	u.RawQuery = queryName
	return u.String(), nil
}
