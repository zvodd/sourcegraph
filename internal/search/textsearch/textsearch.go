package textsearch

import (
	"context"

	"golang.org/x/sync/errgroup"

	"github.com/sourcegraph/sourcegraph/internal/database"
	"github.com/sourcegraph/sourcegraph/internal/search"
	"github.com/sourcegraph/sourcegraph/internal/search/query"
	searchrepos "github.com/sourcegraph/sourcegraph/internal/search/repos"
	"github.com/sourcegraph/sourcegraph/internal/search/result"
	"github.com/sourcegraph/sourcegraph/internal/search/searcher"
	"github.com/sourcegraph/sourcegraph/internal/search/streaming"
	zoektutil "github.com/sourcegraph/sourcegraph/internal/search/zoekt"
	"github.com/sourcegraph/sourcegraph/internal/trace"
	"github.com/sourcegraph/sourcegraph/lib/errors"
)

var MockSearchFilesInRepos func() ([]result.Match, *streaming.Stats, error)

// SearchFilesInRepos searches a set of repos for a pattern.
func SearchFilesInRepos(
	ctx context.Context,
	runZoekt func(context.Context, database.DB, streaming.Sender) (*search.Alert, error),
	unindexedRepos []*search.RepositoryRevisions,
	searcherArgs *search.SearcherParameters,
	notSearcherOnly bool,
	stream streaming.Sender,
) (err error) {
	if MockSearchFilesInRepos != nil {
		matches, mockStats, err := MockSearchFilesInRepos()
		stream.Send(streaming.SearchEvent{
			Results: matches,
			Stats:   mockStats.Deref(),
		})
		return err
	}

	g, ctx := errgroup.WithContext(ctx)

	if notSearcherOnly {
		// Run literal and regexp searches on indexed repositories.
		g.Go(func() error {
			_, err := runZoekt(ctx, nil, stream)
			return err
		})
	}

	// Concurrently run searcher for all unindexed repos regardless whether text or regexp.
	g.Go(func() error {
		return searcher.SearchOverRepos(ctx, searcherArgs, stream, unindexedRepos, false)
	})

	return g.Wait()
}

// SearchFilesInReposBatch is a convenience function around searchFilesInRepos
// which collects the results from the stream.
func SearchFilesInReposBatch(
	ctx context.Context,
	runZoekt func(context.Context, database.DB, streaming.Sender) (*search.Alert, error),
	unindexedRepos []*search.RepositoryRevisions,
	searcherArgs *search.SearcherParameters,
	searcherOnly bool,
) ([]*result.FileMatch, streaming.Stats, error) {
	agg := streaming.NewAggregatingStream()
	err := SearchFilesInRepos(ctx, runZoekt, unindexedRepos, searcherArgs, searcherOnly, agg)

	fms, fmErr := matchesToFileMatches(agg.Results)
	if fmErr != nil && err == nil {
		err = errors.Wrap(fmErr, "searchFilesInReposBatch failed to convert results")
	}
	return fms, agg.Stats, err
}

func matchesToFileMatches(matches []result.Match) ([]*result.FileMatch, error) {
	fms := make([]*result.FileMatch, 0, len(matches))
	for _, match := range matches {
		fm, ok := match.(*result.FileMatch)
		if !ok {
			return nil, errors.Errorf("expected only file match results")
		}
		fms = append(fms, fm)
	}
	return fms, nil
}

type RepoSubsetTextSearch struct {
	RunZoekt         func(context.Context, database.DB, streaming.Sender) (*search.Alert, error)
	SearcherArgs     *search.SearcherParameters
	NotSearcherOnly  bool
	UseIndex         query.YesNoOnly
	ContainsRefGlobs bool

	RepoOpts search.RepoOptions
}

func (t *RepoSubsetTextSearch) Run(ctx context.Context, db database.DB, stream streaming.Sender) (_ *search.Alert, err error) {
	tr, ctx := trace.New(ctx, "RepoSubsetTextSearch", "")
	defer func() {
		tr.SetError(err)
		tr.Finish()
	}()

	repos := &searchrepos.Resolver{DB: db, Opts: t.RepoOpts}
	return nil, repos.Paginate(ctx, nil, func(page *searchrepos.Resolved) error {
		request, ok, err := zoektutil.OnlyUnindexed(page.RepoRevs, nil, t.UseIndex, t.ContainsRefGlobs, zoektutil.MissingRepoRevStatus(stream)) // FIXME: t.ZoektArgs.
		if err != nil {
			return err
		}

		if !ok {
			request, err = zoektutil.NewIndexedSubsetSearchRequest(ctx, page.RepoRevs, t.UseIndex, nil, zoektutil.MissingRepoRevStatus(stream)) // FIXME: t.ZoektArgs.
			if err != nil {
				return err
			}
		}

		return SearchFilesInRepos(ctx, t.RunZoekt, request.UnindexedRepos(), t.SearcherArgs, t.NotSearcherOnly, stream)
	})
}

func (*RepoSubsetTextSearch) Name() string {
	return "RepoSubsetText"
}

type RepoUniverseTextSearch struct {
	GlobalZoektQuery *zoektutil.GlobalZoektQuery
	ZoektArgs        *search.ZoektParameters

	RepoOptions search.RepoOptions
	UserID      int32
}

func (t *RepoUniverseTextSearch) Run(ctx context.Context, db database.DB, stream streaming.Sender) (_ *search.Alert, err error) {
	tr, ctx := trace.New(ctx, "RepoUniverseTextSearch", "")
	defer func() {
		tr.SetError(err)
		tr.Finish()
	}()

	if t.ZoektArgs == nil {
		return nil, nil
	}

	userPrivateRepos := searchrepos.PrivateReposForActor(ctx, db, t.RepoOptions)
	t.GlobalZoektQuery.ApplyPrivateFilter(userPrivateRepos)
	t.ZoektArgs.Query = t.GlobalZoektQuery.Generate()

	g, ctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		return zoektutil.DoZoektSearchGlobal(ctx, t.ZoektArgs, stream)
	})
	return nil, g.Wait()
}

func (*RepoUniverseTextSearch) Name() string {
	return "RepoUniverseText"
}
