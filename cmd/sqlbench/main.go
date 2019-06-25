package main

import (
	"flag"
	"net/http"
	"time"

	_ "net/http/pprof"

	// _ "github.com/lib/pq"
	_ "github.com/jackc/pgx/stdlib"
	"github.com/sourcegraph/sourcegraph/cmd/repo-updater/repos"

	"database/sql"
	"fmt"
	"log"
)

func main() {
	maxConns := flag.Int("max-conns", 50, "Max SQL conns")
	flag.Parse()
	if err := run(*maxConns); err != nil {
		log.Fatal(err)
	}
}

func run(maxConns int) error {
	db, err := sql.Open("pgx", flag.Arg(0))
	if err != nil {
		return err
	}

	db.SetConnMaxLifetime(time.Minute)
	db.SetMaxIdleConns(maxConns)
	db.SetMaxOpenConns(maxConns)

	defer db.Close()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		repos, err := load(db)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		fmt.Fprintf(w, "%d\n", len(repos))
	})

	return http.ListenAndServe(flag.Arg(1), nil)
}

const q = `
SELECT
  id,
  name,
  external_id,
  external_service_type,
  external_service_id
FROM repo
`

func load(db *sql.DB) ([]*repos.Repo, error) {
	rows, err := db.Query(q)
	if err != nil {
		return nil, err
	}

	var all []*repos.Repo
	for rows.Next() {
		var r repos.Repo
		if err := rows.Scan(
			&r.ID,
			&r.Name,
			// &r.Description,
			// &r.Language,
			// &r.CreatedAt,
			// &dbutil.NullTime{Time: &r.UpdatedAt},
			&r.ExternalRepo.ID,
			&r.ExternalRepo.ServiceType,
			&r.ExternalRepo.ServiceID,
			// &r.URI,
		); err != nil {
			return nil, err
		}
		all = append(all, &r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return all, nil
}
