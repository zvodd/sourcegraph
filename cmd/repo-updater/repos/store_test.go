package repos

import (
	"context"
	"flag"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"

	"github.com/sourcegraph/sourcegraph/pkg/api"
)

var postgresDSN = flag.String(
	"postgres-dsn",
	"postgres://sourcegraph:sourcegraph@localhost/?sslmode=disable&timezone=UTC",
	"Postgres connection string to use in integration tests",
)

func init() {
	flag.Parse()
}

func TestIntegration_DBStore(t *testing.T) {
	t.Parallel()

	db, cleanup := testDatabase(t, *postgresDSN)
	defer cleanup()

	store, err := NewDBStore(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}

	type upsert struct {
		repo *Repo
		err  error
	}

	ctx := context.Background()
	ch := make(chan upsert, 1023) // test pagination with odd number

	for i := 0; i < cap(ch); i++ {
		id := strconv.Itoa(i)
		go func(up upsert) {
			up.err = store.UpsertRepo(ctx, up.repo)
			ch <- up
		}(upsert{repo: &Repo{
			Name:        api.RepoName("github.com/foo/bar" + id),
			Description: "It's a foo's bar",
			Language:    "barlang",
			Enabled:     true,
			Archived:    false,
			Fork:        false,
			CreatedAt:   time.Now().UTC(),
			ExternalRepo: api.ExternalRepoSpec{
				ID:          id,
				ServiceType: "github",
				ServiceID:   "http://github.com",
			},
		}})
	}

	want := make([]*Repo, 0, cap(ch))
	for i := 0; i < cap(ch); i++ {
		if up := <-ch; up.err != nil {
			t.Errorf("UpsertRepo for %q error: %s", up.repo.Name, up.err)
		} else {
			want = append(want, up.repo)
		}
	}

	sort.Slice(want, func(i, j int) bool {
		return want[i]._ID < want[j]._ID
	})

	have, err := store.ListRepos(ctx)
	if err != nil {
		t.Fatalf("ListRepos error: %s", err)
	}

	if diff := cmp.Diff(want, have); diff != "" {
		t.Errorf("ListRepos: (-want +have)\n%s", diff)
	}
}
