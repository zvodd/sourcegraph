package repos

import (
	"context"
	"flag"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/kylelemons/godebug/pretty"
	"github.com/sourcegraph/sourcegraph/pkg/api"
)

var dsn = flag.String(
	"dsn",
	"postgres://sourcegraph:sourcegraph@localhost/postgres?sslmode=disable&timezone=UTC",
	"Database connection string to use in integration tests",
)

func init() {
	flag.Parse()
}

func TestIntegration_DBStore(t *testing.T) {
	t.Parallel()

	db, cleanup := testDatabase(t, *dsn)
	defer cleanup()

	store, err := NewDBStore(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	want := make([]*Repo, 0, 512) // Test more than one page load
	for i := 0; i < cap(want); i++ {
		id := strconv.Itoa(i)
		want = append(want, &Repo{
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
		})
	}

	if err := store.UpsertRepos(ctx, want...); err != nil {
		t.Fatalf("UpsertRepos error: %s", err)
	}

	sort.Slice(want, func(i, j int) bool {
		return want[i]._ID < want[j]._ID
	})

	have, err := store.ListRepos(ctx)
	if err != nil {
		t.Fatalf("ListRepos error: %s", err)
	}

	if diff := pretty.Compare(have, want); diff != "" {
		t.Errorf("ListRepos:\n%s", diff)
	}

	for i := 1; i <= 5; i++ {
		suffix := " " + strconv.Itoa(i)
		now := time.Now()
		for _, r := range want {
			r.Name += api.RepoName(suffix)
			r.Description += suffix
			r.Language += suffix
			r.DeletedAt = now
			r.UpdatedAt = now
			r.Archived = !r.Archived
			r.Fork = !r.Fork

			// Not updateable fields. Check that that UpsertRepos
			// restores their original value.
			r._ID += 10000
			r.Enabled = !r.Enabled
			r.CreatedAt = r.CreatedAt.Add(time.Minute)
		}

		if err := store.UpsertRepos(ctx, want...); err != nil {
			t.Fatalf("UpsertRepos error: %s", err)
		}

		have, err = store.ListRepos(ctx)
		if err != nil {
			t.Fatalf("ListRepos error: %s", err)
		}

		if diff := pretty.Compare(have, want); diff != "" {
			t.Errorf("ListRepos:\n%s", diff)
		}
	}
}
