package repos

import (
	"database/sql"
	"os"

	migr "github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	bindata "github.com/golang-migrate/migrate/v4/source/go_bindata"
	"github.com/pkg/errors"
	"github.com/sourcegraph/sourcegraph/migrations"
	log15 "gopkg.in/inconshreveable/log15.v2"
)

// NewDB returns a new *sql.DB from the given dsn (data source name).
func NewDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, errors.Wrap(err, "failed to connect to database")
	}

	db.SetMaxOpenConns(25)

	return db, nil
}

// Migrate runs all migrations from github.com/sourcegraph/sourcegraph/migrations
// against the given sql.DB
func MigrateDB(db *sql.DB) error {
	var cfg postgres.Config
	driver, err := postgres.WithInstance(db, &cfg)
	if err != nil {
		return err
	}

	s := bindata.Resource(migrations.AssetNames(), migrations.Asset)
	d, err := bindata.WithInstance(s)
	if err != nil {
		return err
	}

	m, err := migr.NewWithInstance("go-bindata", d, "postgres", driver)
	if err != nil {
		return err
	}

	err = m.Up()
	if err == nil || err == migr.ErrNoChange {
		return nil
	}

	if os.IsNotExist(err) {
		// This should only happen if the DB is ahead of the migrations available
		version, dirty, verr := m.Version()
		if verr != nil {
			return verr
		}
		if dirty { // this shouldn't happen, but checking anyways
			return err
		}
		log15.Warn("WARNING: Detected an old version of Sourcegraph. The database has migrated to a newer version. If you have applied a rollback, this is expected and you can ignore this warning. If not, please contact support@sourcegraph.com for further assistance.", "db_version", version)
		return nil
	}
	return err
}
