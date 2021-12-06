package lsifstore

import (
	"context"

	"github.com/keegancsmith/sqlf"

	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
)

// Diagnostics returns the diagnostics for the documents that have the given path prefix. This method
// also returns the size of the complete result set to aid in pagination.
func (s *Store) Diagnostics(ctx context.Context, bundleID int, prefix string, limit, offset int) (_ []Diagnostic, _ int, err error) {
	ctx, traceLog, endObservation := s.operations.diagnostics.WithAndLogger(ctx, &err, obsv.Args{LogFields: []obsv.Field{
		obsv.Int("bundleID", bundleID),
		obsv.String("prefix", prefix),
		obsv.Int("limit", limit),
		obsv.Int("offset", offset),
	}})
	defer endObservation(1, obsv.Args{})

	documentData, err := s.scanDocumentData(s.Store.Query(ctx, sqlf.Sprintf(diagnosticsQuery, bundleID, prefix+"%")))
	if err != nil {
		return nil, 0, err
	}
	traceLog(obsv.Int("numDocuments", len(documentData)))

	totalCount := 0
	for _, documentData := range documentData {
		totalCount += len(documentData.Document.Diagnostics)
	}
	traceLog(obsv.Int("totalCount", totalCount))

	diagnostics := make([]Diagnostic, 0, limit)
	for _, documentData := range documentData {
		for _, diagnostic := range documentData.Document.Diagnostics {
			offset--

			if offset < 0 && len(diagnostics) < limit {
				diagnostics = append(diagnostics, Diagnostic{
					DumpID:         bundleID,
					Path:           documentData.Path,
					DiagnosticData: diagnostic,
				})
			}
		}
	}

	return diagnostics, totalCount, nil
}

const diagnosticsQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/diagnostics.go:Diagnostics
SELECT
	dump_id,
	path,
	data,
	NULL AS ranges,
	NULL AS hovers,
	NULL AS monikers,
	NULL AS packages,
	diagnostics
FROM
	lsif_data_documents
WHERE
	dump_id = %s AND
	path LIKE %s
ORDER BY path
`
