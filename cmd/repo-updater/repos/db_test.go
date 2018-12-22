package repos

import (
	"database/sql"
	"math/rand"
	"net/url"
	"os"
	"strconv"
	"testing"
	"time"
)

func testDatabase(t testing.TB) (*sql.DB, func()) {
	dsn := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(os.Getenv("PGUSER"), os.Getenv("PGPASSWORD")),
		Host:   "localhost",
		Path:   os.Getenv("PGDATABASE"),
	}

	db, err := sql.Open("postgres", dsn.String())
	if err != nil {
		t.Fatalf("failed to connect to database: %s", err)
	}

	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	schema := dsn.Path + "-" + strconv.FormatInt(rng.Int63(), 10)

	_, err = db.Exec(`CREATE SCHEMA "` + schema + `"`)
	if err != nil {
		t.Fatalf("failed to create schema: %s", err)
	}

	_, err = db.Exec(`SET search_path TO "` + schema + `", public`)
	if err != nil {
		t.Fatalf("failed to set default schema to %q: %s", schema, err)
	}

	if err = MigrateDB(db); err != nil {
		t.Fatalf("failed to apply migrations: %s", err)
	}

	return db, func() {
		_, err := db.Exec(`DROP SCHEMA "` + schema + `" CASCADE`)
		if err != nil {
			t.Fatalf("failed to drop schema: %s", err)
		}
	}
}
