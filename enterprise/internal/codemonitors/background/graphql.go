package background

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/graphql-go/graphql/gqlerrors"
	"github.com/opentracing/opentracing-go"
	"github.com/opentracing/opentracing-go/log"

	"github.com/sourcegraph/sourcegraph/cmd/frontend/envvar"
	"github.com/sourcegraph/sourcegraph/internal/actor"
	"github.com/sourcegraph/sourcegraph/internal/api/internalapi"
	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/httpcli"
	"github.com/sourcegraph/sourcegraph/internal/search"
	"github.com/sourcegraph/sourcegraph/internal/search/client"
	"github.com/sourcegraph/sourcegraph/internal/search/commit"
	"github.com/sourcegraph/sourcegraph/internal/search/job"
	"github.com/sourcegraph/sourcegraph/internal/search/predicate"
	"github.com/sourcegraph/sourcegraph/internal/search/repos"
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

func doSearch(ctx context.Context, db database.DB, query string, settings *schema.Settings) (_ []*result.CommitMatch, err error) {
	searchClient := client.NewSearchClient(db, search.Indexed(), search.SearcherURLs())
	inputs, err := searchClient.Plan(ctx, "V2", nil, query, search.Streaming, settings, envvar.SourcegraphDotComMode())
	if err != nil {
		return nil, err
	}

	jobArgs := searchClient.JobArgs(inputs)
	plan, err := predicate.Expand(ctx, db, jobArgs, inputs.Plan)
	if err != nil {
		return nil, err
	}

	planJob, err := job.FromExpandedPlan(jobArgs, plan)
	if err != nil {
		return nil, err
	}

	actor := actor.FromContext(ctx)
	ffs, err := db.FeatureFlags().GetUserFlags(ctx, actor.UID)
	if err != nil {
		return nil, err
	}

	if enabled, ok := ffs["cc-repo-aware-monitors"]; ok && enabled {
		planJob = mapJob(planJob)
	}

	agg := streaming.NewAggregatingStream()
	_, err = planJob.Run(ctx, db, agg)
	if err != nil {
		return nil, err
	}

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

func mapJob(in job.Job) (_ job.Job, err error) {
	mapper := job.Mapper{
		// Ignore any leaf nodes that aren't commit/diff searches
		MapRepoSearchJob:               func(*run.RepoSearch) *run.RepoSearch { return nil },
		MapRepoSubsetTextSearchJob:     func(*textsearch.RepoSubsetTextSearch) *textsearch.RepoSubsetTextSearch { return nil },
		MapRepoUniverseTextSearchJob:   func(*textsearch.RepoUniverseTextSearch) *textsearch.RepoUniverseTextSearch { return nil },
		MapStructuralSearchJob:         func(*structural.StructuralSearch) *structural.StructuralSearch { return nil },
		MapRepoSubsetSymbolSearchJob:   func(*symbol.RepoSubsetSymbolSearch) *symbol.RepoSubsetSymbolSearch { return nil },
		MapRepoUniverseSymbolSearchJob: func(*symbol.RepoUniverseSymbolSearch) *symbol.RepoUniverseSymbolSearch { return nil },
		MapComputeExcludedReposJob:     func(*repos.ComputeExcludedRepos) *repos.ComputeExcludedRepos { return nil },

		MapCommitSearchJob: func(c *commit.CommitSearch) *commit.CommitSearch {
			c, commitErr := mapCommitJob(c)
			if commitErr != nil {
				err = errors.Append(err, commitErr)
			}
			return c
		},
	}

	return mapper.Map(in), err
}

func mapCommitJob(*commit.CommitSearch) (*commit.CommitSearch, error)

func gqlURL(queryName string) (string, error) {
	u, err := url.Parse(internalapi.Client.URL)
	if err != nil {
		return "", err
	}
	u.Path = "/.internal/graphql"
	u.RawQuery = queryName
	return u.String(), nil
}
