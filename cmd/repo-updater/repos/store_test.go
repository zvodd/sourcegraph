package repos

import (
	"context"
	"testing"
	"time"

	"github.com/sourcegraph/sourcegraph/pkg/api"
)

func TestIntegration_DBStore(t *testing.T) {
	t.Parallel()

	db, cleanup := testDatabase(t)
	defer cleanup()

	store := NewDBStore(db)
	err := store.UpsertRepo(context.Background(), &Repo{
		Name:        "github.com/tsenart/vegeta",
		Description: "It's over 9000!",
		Language:    "golang",
		Enabled:     true,
		Archived:    false,
		Fork:        false,
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		DeletedAt:   time.Now().UTC(),
		ExternalRepo: api.ExternalRepoSpec{
			ID:          "vegeta",
			ServiceType: "github",
			ServiceID:   "http://github.com",
		},
	})
	if err != nil {
		t.Error(err)
	}
}
