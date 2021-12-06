package resolvers

import (
	"context"
	"time"

	"github.com/cockroachdb/errors"

	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
)

const slowDefinitionsRequestThreshold = time.Second

// DefinitionsLimit is maximum the number of locations returned from Definitions.
const DefinitionsLimit = 100

// Definitions returns the list of source locations that define the symbol at the given position.
func (r *queryResolver) Definitions(ctx context.Context, line, character int) (_ []AdjustedLocation, err error) {
	ctx, traceLog, endObservation := observeResolver(ctx, &err, "Definitions", r.operations.definitions, slowDefinitionsRequestThreshold, obsv.Args{
		LogFields: []obsv.Field{
			obsv.Int("repositoryID", r.repositoryID),
			obsv.String("commit", r.commit),
			obsv.String("path", r.path),
			obsv.Int("numUploads", len(r.uploads)),
			obsv.String("uploads", uploadIDsToString(r.uploads)),
			obsv.Int("line", line),
			obsv.Int("character", character),
		},
	})
	defer endObservation()

	// Adjust the path and position for each visible upload based on its git difference to
	// the target commit.

	adjustedUploads, err := r.adjustUploads(ctx, line, character)
	if err != nil {
		return nil, err
	}

	// Gather the "local" reference locations that are reachable via a referenceResult vertex.
	// If the definition exists within the index, it should be reachable via an LSIF graph
	// traversal and should not require an additional moniker search in the same index.

	for i := range adjustedUploads {
		traceLog(obsv.Int("uploadID", adjustedUploads[i].Upload.ID))

		locations, _, err := r.lsifStore.Definitions(
			ctx,
			adjustedUploads[i].Upload.ID,
			adjustedUploads[i].AdjustedPathInBundle,
			adjustedUploads[i].AdjustedPosition.Line,
			adjustedUploads[i].AdjustedPosition.Character,
			DefinitionsLimit,
			0,
		)
		if err != nil {
			return nil, errors.Wrap(err, "lsifStore.Definitions")
		}
		if len(locations) > 0 {
			// If we have a local definition, we won't find a better one and can exit early
			return r.adjustLocations(ctx, locations)
		}
	}

	// Gather all import monikers attached to the ranges enclosing the requested position
	orderedMonikers, err := r.orderedMonikers(ctx, adjustedUploads, "import")
	if err != nil {
		return nil, err
	}
	traceLog(
		obsv.Int("numMonikers", len(orderedMonikers)),
		obsv.String("monikers", monikersToString(orderedMonikers)),
	)

	// Determine the set of uploads over which we need to perform a moniker search. This will
	// include all all indexes which define one of the ordered monikers. This should not include
	// any of the indexes we have already performed an LSIF graph traversal in above.
	uploads, err := r.definitionUploads(ctx, orderedMonikers)
	if err != nil {
		return nil, err
	}
	traceLog(
		obsv.Int("numDefinitionUploads", len(uploads)),
		obsv.String("definitionUploads", uploadIDsToString(uploads)),
	)

	// Perform the moniker search
	locations, _, err := r.monikerLocations(ctx, uploads, orderedMonikers, "definitions", DefinitionsLimit, 0)
	if err != nil {
		return nil, err
	}
	traceLog(obsv.Int("numLocations", len(locations)))

	// Adjust the locations back to the appropriate range in the target commits. This adjusts
	// locations within the repository the user is browsing so that it appears all definitions
	// are occurring at the same commit they are looking at.

	adjustedLocations, err := r.adjustLocations(ctx, locations)
	if err != nil {
		return nil, err
	}
	traceLog(obsv.Int("numAdjustedLocations", len(adjustedLocations)))

	return adjustedLocations, nil
}
