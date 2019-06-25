package main

import (
	_ "github.com/lib/pq"
	"github.com/sourcegraph/sourcegraph/cmd/repo-updater/repos"

	"database/sql"
	"fmt"
	"log"
	"os"
	"time"
)

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	db, err := sql.Open("postgres", os.Args[1])
	if err != nil {
		return err
	}

	defer db.Close()

	q := `SELECT id, name, external_id, external_service_id, external_service_type FROM repo`

	began := time.Now()
	rows, err := db.Query(q)
	if err != nil {
		return err
	}

	var all []*repos.Repo
	for rows.Next() {
		var r repos.Repo
		if err := rows.Scan(
			&r.ID,
			&r.Name,
			&r.ExternalRepo.ID,
			&r.ExternalRepo.ServiceID,
			&r.ExternalRepo.ServiceType,
		); err != nil {
			return err
		}
		all = append(all, &r)
	}

	if err := rows.Err(); err != nil {
		return err
	}

	fmt.Println(time.Since(began))

	return nil
}
