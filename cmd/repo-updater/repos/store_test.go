package repos

import (
	"context"
	"database/sql"
	"sort"
	"strconv"
	"testing"
	"time"

	"github.com/kylelemons/godebug/pretty"
	"github.com/sourcegraph/sourcegraph/pkg/api"
)

func TestIntegration_DBStore(t *testing.T) {
	t.Parallel()

	db, cleanup := testDatabase(t)
	defer cleanup()

	ctx := context.Background()
	store, err := NewDBStore(ctx, db, sql.TxOptions{Isolation: sql.LevelSerializable})
	if err != nil {
		t.Fatal(err)
	}

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

	txstore, closetx, err := store.Transact(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer closetx(&err)

	if err = txstore.UpsertRepos(ctx, want...); err != nil {
		t.Errorf("UpsertRepos error: %s", err)
		return
	}

	sort.Slice(want, func(i, j int) bool {
		return want[i]._ID < want[j]._ID
	})

	have, err := txstore.ListRepos(ctx)
	if err != nil {
		t.Errorf("ListRepos error: %s", err)
		return
	}

	if diff := pretty.Compare(have, want); diff != "" {
		t.Errorf("ListRepos:\n%s", diff)
		return
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

		if err = txstore.UpsertRepos(ctx, want...); err != nil {
			t.Errorf("UpsertRepos error: %s", err)
			return
		}

		have, err = txstore.ListRepos(ctx)
		if err != nil {
			t.Errorf("ListRepos error: %s", err)
			return
		}

		if diff := pretty.Compare(have, want); diff != "" {
			t.Errorf("ListRepos:\n%s", diff)
		}
	}
}
