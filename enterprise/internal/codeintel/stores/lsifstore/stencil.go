package lsifstore

import (
	"context"

	"github.com/keegancsmith/sqlf"

	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
)

// Stencil return all ranges within a single document.
func (s *Store) Stencil(ctx context.Context, bundleID int, path string) (_ []Range, err error) {
	ctx, traceLog, endObservation := s.operations.stencil.WithAndLogger(ctx, &err, obsv.Args{LogFields: []obsv.Field{
		obsv.Int("bundleID", bundleID),
		obsv.String("path", path),
	}})
	defer endObservation(1, obsv.Args{})

	documentData, exists, err := s.scanFirstDocumentData(s.Store.Query(ctx, sqlf.Sprintf(rangesDocumentQuery, bundleID, path)))
	if err != nil || !exists {
		return nil, err
	}

	traceLog(obsv.Int("numRanges", len(documentData.Document.Ranges)))

	ranges := make([]Range, 0, len(documentData.Document.Ranges))
	for _, r := range documentData.Document.Ranges {
		ranges = append(ranges, newRange(r.StartLine, r.StartCharacter, r.EndLine, r.EndCharacter))
	}

	return ranges, nil
}
