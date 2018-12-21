package repos

import (
	"context"

	"github.com/sourcegraph/sourcegraph/pkg/repoupdater/protocol"
)

// A Store exposes methods to read and write persistent repositories.
type Store interface {
	Repos(ctx context.Context) ([]*protocol.RepoInfo, error)
	UpsertRepo(ctx context.Context, repo *protocol.RepoInfo) error
}

// FrontendAPIStore implements the Store interface for reading and writing repos
// via the Sourcegraph Frontend API.
//
// XXX(tsenart): Dependency inject frontend API client once that code is refactored.
type FrontendAPIStore struct{}

// NewFrontendAPIStore instantiates and returns a new FrontendAPIStore.
func NewFrontendAPIStore() *FrontendAPIStore {
	return &FrontendAPIStore{}
}

// GetRepos gets all configured repositories in Sourcegraph.
func (s FrontendAPIStore) Repos(ctx context.Context) ([]*protocol.RepoInfo, error) {
	panic("not implemented")
}

// UpsertRepo updates or inserts the given repo in the Sourcegraph repository store.
func (s FrontendAPIStore) UpsertRepo(ctx context.Context, repo *protocol.RepoInfo) error {
	panic("not implemented")
}
