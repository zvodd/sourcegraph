package repos

import (
	"context"
	"database/sql"
)

// A Store exposes methods to read and write persistent repositories.
type Store interface {
	Repos(ctx context.Context) ([]*Repo, error)
	UpsertRepo(ctx context.Context, repo *Repo) error
}

// DBStore implements the Store interface for reading and writing repos directly
// from the Postgres database.
type DBStore struct {
	db *sql.DB
}

// NewDBStore instantiates and returns a new DBStore.
func NewDBStore(db *sql.DB) *DBStore {
	return &DBStore{db: db}
}

// GetRepos gets all configured repositories in Sourcegraph.
func (s DBStore) Repos(ctx context.Context) ([]*Repo, error) {
	panic("not implemented")
}

// UpsertRepo updates or inserts the given repo in the Sourcegraph repository store.
func (s DBStore) UpsertRepo(ctx context.Context, repo *Repo) error {
	panic("not implemented")
}
