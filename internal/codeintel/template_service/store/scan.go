package store

import (
	"database/sql"

	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
)

type Thing struct {
	ID      int
	Version string
}

func scanThings(rows *sql.Rows, queryErr error) (things []Thing, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	for rows.Next() {
		var thing Thing

		if err = rows.Scan(
			&thing.ID,
		); err != nil {
			return nil, err
		}

		things = append(things, thing)
	}

	return things, nil
}
