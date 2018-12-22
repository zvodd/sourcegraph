package repos

import (
	"database/sql"
	"math/rand"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/lib/pq"
)

func testDatabase(t testing.TB, dsn string) (*sql.DB, func()) {
	config, err := url.Parse(dsn)
	if err != nil {
		t.Fatalf("failed to parse dsn %q: %s", dsn, err)
	}
	config.Path = "/postgres"

	// We want to configure the database client explicitly through the DSN.
	// lib/pq uses and gives precedence to these environment variables so we unset them.
	for _, v := range []string{
		"PGHOST", "PGHOSTADDR", "PGPORT",
		"PGDATABASE", "PGUSER", "PGPASSWORD",
		"PGSERVICE", "PGSERVICEFILE", "PGREALM",
		"PGOPTIONS", "PGAPPNAME", "PGSSLMODE",
		"PGSSLCERT", "PGSSLKEY", "PGSSLROOTCERT",
		"PGREQUIRESSL", "PGSSLCRL", "PGREQUIREPEER",
		"PGKRBSRVNAME", "PGGSSLIB", "PGCONNECT_TIMEOUT",
		"PGCLIENTENCODING", "PGDATESTYLE", "PGTZ",
		"PGGEQO", "PGSYSCONFDIR", "PGLOCALEDIR",
	} {
		os.Unsetenv(v)
	}

	db, err := NewDB(config.String())
	if err != nil {
		t.Fatalf("failed to connect to database: %s", err)
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	dbname := "sourcegraph-test-" + strconv.FormatUint(rng.Uint64(), 10)

	_, err = db.Exec(`CREATE DATABASE ` + pq.QuoteIdentifier(dbname))
	if err != nil {
		t.Fatalf("failed to run create databse %s: %s", dbname, err)
	}

	config.Path = "/" + dbname
	db, err = NewDB(config.String())
	if err != nil {
		t.Fatalf("failed to connect to database: %s", err)
	}

	if err = MigrateDB(db); err != nil {
		t.Fatalf("failed to apply migrations: %s", err)
	}

	return db, func() {
		if !t.Failed() {
			_, err := db.Exec(`DROP DATABASE ` + pq.QuoteIdentifier(dbname) + ` CASCADE`)
			if err != nil {
				t.Errorf("failed to drop schema: %s", err)
			}
		} else {
			t.Logf("DATABASE %s left intact for inspection", dbname)
		}
	}
}
