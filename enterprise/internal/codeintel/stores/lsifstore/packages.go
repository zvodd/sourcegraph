package lsifstore

import (
	"context"

	"github.com/keegancsmith/sqlf"

	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/lib/codeintel/precise"
)

// PackageInformation looks up package information data by identifier.
func (s *Store) PackageInformation(ctx context.Context, bundleID int, path, packageInformationID string) (_ precise.PackageInformationData, _ bool, err error) {
	ctx, endObservation := s.operations.packageInformation.With(ctx, &err, obsv.Args{LogFields: []obsv.Field{
		obsv.Int("bundleID", bundleID),
		obsv.String("path", path),
		obsv.String("packageInformationID", packageInformationID),
	}})
	defer endObservation(1, obsv.Args{})

	documentData, exists, err := s.scanFirstDocumentData(s.Store.Query(ctx, sqlf.Sprintf(packageInformationQuery, bundleID, path)))
	if err != nil || !exists {
		return precise.PackageInformationData{}, false, err
	}

	packageInformationData, exists := documentData.Document.PackageInformation[precise.ID(packageInformationID)]
	return packageInformationData, exists, nil
}

const packageInformationQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/packages.go:PackageInformation
SELECT
	dump_id,
	path,
	data,
	NULL AS ranges,
	NULL AS hovers,
	NULL AS monikers,
	packages,
	NULL AS diagnostics
FROM
	lsif_data_documents
WHERE
	dump_id = %s AND
	path = %s
LIMIT 1
`
