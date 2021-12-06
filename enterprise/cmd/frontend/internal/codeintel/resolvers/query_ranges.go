package resolvers

import (
	"context"
	"time"

	"github.com/cockroachdb/errors"

	"github.com/sourcegraph/sourcegraph/enterprise/internal/codeintel/stores/lsifstore"
	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
)

const slowRangesRequestThreshold = time.Second

// Ranges returns code intelligence for the ranges that fall within the given range of lines. These
// results are partial and do not include references outside the current file, or any location that
// requires cross-linking of bundles (cross-repo or cross-root).
func (r *queryResolver) Ranges(ctx context.Context, startLine, endLine int) (adjustedRanges []AdjustedCodeIntelligenceRange, err error) {
	ctx, traceLog, endObservation := observeResolver(ctx, &err, "Ranges", r.operations.ranges, slowRangesRequestThreshold, obsv.Args{
		LogFields: []obsv.Field{
			obsv.Int("repositoryID", r.repositoryID),
			obsv.String("commit", r.commit),
			obsv.String("path", r.path),
			obsv.Int("numUploads", len(r.uploads)),
			obsv.String("uploads", uploadIDsToString(r.uploads)),
			obsv.Int("startLine", startLine),
			obsv.Int("endLine", endLine),
		},
	})
	defer endObservation()

	adjustedUploads, err := r.adjustUploadPaths(ctx)
	if err != nil {
		return nil, err
	}

	for i := range adjustedUploads {
		traceLog(obsv.Int("uploadID", adjustedUploads[i].Upload.ID))

		ranges, err := r.lsifStore.Ranges(
			ctx,
			adjustedUploads[i].Upload.ID,
			adjustedUploads[i].AdjustedPathInBundle,
			startLine, // TODO - adjust these as well
			endLine,   // TODO - adjust these as well
		)
		if err != nil {
			return nil, errors.Wrap(err, "lsifStore.Ranges")
		}

		for _, rn := range ranges {
			adjustedRange, ok, err := r.adjustCodeIntelligenceRange(ctx, adjustedUploads[i], rn)
			if err != nil {
				return nil, err
			}
			if !ok {
				continue
			}

			adjustedRanges = append(adjustedRanges, adjustedRange)
		}
	}
	traceLog(obsv.Int("numRanges", len(adjustedRanges)))

	return adjustedRanges, nil
}

// adjustCodeIntelligenceRange translates a range summary (relative to the indexed commit) into an
// equivalent range summary in the requested commit. If the translation fails, a false-valued flag
// is returned.
func (r *queryResolver) adjustCodeIntelligenceRange(ctx context.Context, upload adjustedUpload, rn lsifstore.CodeIntelligenceRange) (AdjustedCodeIntelligenceRange, bool, error) {
	_, adjustedRange, ok, err := r.adjustRange(ctx, upload.Upload.RepositoryID, upload.Upload.Commit, upload.AdjustedPath, rn.Range)
	if err != nil || !ok {
		return AdjustedCodeIntelligenceRange{}, false, err
	}

	adjustedDefinitions, err := r.adjustLocations(ctx, rn.Definitions)
	if err != nil {
		return AdjustedCodeIntelligenceRange{}, false, err
	}

	adjustedReferences, err := r.adjustLocations(ctx, rn.References)
	if err != nil {
		return AdjustedCodeIntelligenceRange{}, false, err
	}

	adjustedImplementations, err := r.adjustLocations(ctx, rn.Implementations)
	if err != nil {
		return AdjustedCodeIntelligenceRange{}, false, err
	}

	return AdjustedCodeIntelligenceRange{
		Range:               adjustedRange,
		Definitions:         adjustedDefinitions,
		References:          adjustedReferences,
		Implementations:     adjustedImplementations,
		HoverText:           rn.HoverText,
		DocumentationPathID: rn.DocumentationPathID,
	}, true, nil
}
