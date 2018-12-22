package repos

import (
	"context"
	"database/sql"

	"github.com/lib/pq"
	"github.com/pkg/errors"
)

// A Store exposes methods to read and write persistent repositories.
type Store interface {
	ListRepos(ctx context.Context) ([]*Repo, error)
	UpsertRepo(ctx context.Context, repo *Repo) error
}

// DBStore implements the Store interface for reading and writing repos directly
// from the Postgres database.
type DBStore struct {
	db         *sql.DB
	upsertRepo *sql.Stmt
	listRepos  *sql.Stmt
}

// NewDBStore instantiates and returns a new DBStore with prepared statements.
func NewDBStore(ctx context.Context, db *sql.DB) (*DBStore, error) {
	store := DBStore{db: db}
	return &store, store.prepare(ctx)
}

// ListRepos lists all configured repositories in Sourcegraph.
func (s DBStore) ListRepos(ctx context.Context) (repos []*Repo, err error) {
	var cursor, next int64 = -1, 0
	for cursor != next && err == nil {
		cursor = next
		if err = s.listReposPage(ctx, cursor, 500, &repos); len(repos) > 0 {
			next = int64(repos[len(repos)-1]._ID)
		}
	}
	return repos, err
}

func (s DBStore) listReposPage(ctx context.Context, cursor, limit int64, repos *[]*Repo) (err error) {
	rows, err := s.listRepos.QueryContext(ctx, cursor, limit)
	if err != nil {
		return err
	}

	defer func() {
		if e := rows.Close(); err == nil {
			err = e
		}
	}()

	for rows.Next() {
		var (
			r                    Repo
			updatedAt, deletedAt pq.NullTime
		)

		if err = rows.Scan(
			&r._ID,
			&r.Name,
			&r.Description,
			&r.Language,
			&r.CreatedAt,
			&updatedAt,
			&deletedAt,
			&r.ExternalRepo.ID,
			&r.ExternalRepo.ServiceType,
			&r.ExternalRepo.ServiceID,
			&r.Enabled,
			&r.Archived,
			&r.Fork,
		); err != nil {
			return err
		}

		r.UpdatedAt, r.DeletedAt = updatedAt.Time, deletedAt.Time
		*repos = append(*repos, &r)
	}

	return rows.Err()
}

const listReposSQL = `
SELECT id, name, description, language, created_at, updated_at, deleted_at,
  external_id, external_service_type, external_service_id, enabled, archived, fork
FROM repo WHERE id > $1 ORDER BY id ASC LIMIT $2
`

// UpsertRepo updates or inserts the given repo in the Sourcegraph repository store.
func (s *DBStore) UpsertRepo(ctx context.Context, r *Repo) error {
	_, err := s.upsertRepo.ExecContext(
		ctx,
		r.Name,
		r.Description,
		r.Language,
		r.CreatedAt.UTC(),
		r.UpdatedAt.UTC(),
		r.DeletedAt.UTC(),
		r.ExternalRepo.ID,
		r.ExternalRepo.ServiceType,
		r.ExternalRepo.ServiceID,
		r.Enabled,
		r.Archived,
		r.Fork,
	)
	return err
}

const upsertRepoSQL = `
INSERT INTO repo (
  name, description, language, uri, created_at,
  external_id, external_service_type, external_service_id,
  enabled, archived, fork
)
VALUES ($1, $2, $3, '', $4, $7, $8, $9, $10, $11, $12)
ON CONFLICT ON CONSTRAINT repo_external_service_unique DO UPDATE
SET (
  name, description, language,
  updated_at, deleted_at, enabled, archived, fork
) = ($1, $2, $3, $5, $6, $10, $11, $12)
`

func (s *DBStore) prepare(ctx context.Context) error {
	for _, st := range []struct {
		stmt  **sql.Stmt
		query string
	}{
		{&s.upsertRepo, upsertRepoSQL},
		{&s.listRepos, listReposSQL},
	} {
		stmt, err := s.db.PrepareContext(ctx, st.query)
		if err != nil {
			return errors.Wrapf(err, "failed to prepare: %s", st.query)
		}
		*st.stmt = stmt
	}

	return nil
}
