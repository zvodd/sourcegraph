package repos

import (
	"context"
	"database/sql"
	"strings"
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
	_, err := s.db.ExecContext(
		ctx,
		upsertSQL,
		repo.Name,
		repo.Description,
		repo.Language,
		"", // URI
		repo.CreatedAt.UTC(),
		repo.UpdatedAt.UTC(),
		repo.DeletedAt.UTC(),
		repo.ExternalRepo.ID,
		repo.ExternalRepo.ServiceType,
		repo.ExternalRepo.ServiceID,
		repo.Enabled,
		repo.Archived,
		repo.Fork,
	)
	return err
}

var upsertSQL = strings.TrimSpace(`
INSERT INTO repo (
    name, description, language, uri, created_at,
    external_id, external_service_type, external_service_id,
    enabled, archived, fork
)
VALUES ($1, $2, $3, $4, $5, $8, $9, $10, $11, $12, $13)
ON CONFLICT ON CONSTRAINT repo_external_service_unique DO UPDATE
SET (
    name, description, language, uri,
    updated_at, deleted_at, enabled, archived, fork
) = ($1, $2, $3, $4, $6, $7, $11, $12, $13)
`)
