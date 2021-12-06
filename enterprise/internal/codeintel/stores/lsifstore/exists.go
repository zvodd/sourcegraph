package lsifstore

import (
	"context"

	"github.com/keegancsmith/sqlf"

	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
)

// Exists determines if the path exists in the database.
func (s *Store) Exists(ctx context.Context, bundleID int, path string) (_ bool, err error) {
	ctx, endObservation := s.operations.exists.With(ctx, &err, obsv.Args{LogFields: []obsv.Field{
		obsv.Int("bundleID", bundleID),
		obsv.String("path", path),
	}})
	defer endObservation(1, obsv.Args{})

	_, exists, err := basestore.ScanFirstString(s.Store.Query(ctx, sqlf.Sprintf(existsQuery, bundleID, path)))
	return exists, err
}

const existsQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/exists.go:Exists
SELECT path FROM lsif_data_documents WHERE dump_id = %s AND path = %s LIMIT 1
`
