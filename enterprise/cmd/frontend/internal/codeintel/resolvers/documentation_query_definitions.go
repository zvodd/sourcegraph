package resolvers

import (
	"context"

	"github.com/cockroachdb/errors"

	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
)

// DocumentationDefinitions returns the list of source locations that define the symbol found at
// the given documentation path ID, if any.
func (r *queryResolver) DocumentationDefinitions(ctx context.Context, pathID string) (_ []AdjustedLocation, err error) {
	ctx, traceLog, endObservation := observeResolver(ctx, &err, "DocumentationDefinitions", r.operations.definitions, slowDefinitionsRequestThreshold, obsv.Args{
		LogFields: []obsv.Field{
			obsv.Int("repositoryID", r.repositoryID),
			obsv.String("commit", r.commit),
			obsv.Int("numUploads", len(r.uploads)),
			obsv.String("uploads", uploadIDsToString(r.uploads)),
			obsv.String("pathID", pathID),
		},
	})
	defer endObservation()

	// Because a documentation path ID is repo-local, i.e. the associated definition is always
	// going to be found in the "local" bundle, i.e. it's not possible for it to be in another
	// repository.
	for _, upload := range r.uploads {
		traceLog(obsv.Int("uploadID", upload.ID))
		locations, _, err := r.lsifStore.DocumentationDefinitions(ctx, upload.ID, pathID, DefinitionsLimit, 0)
		if err != nil {
			return nil, errors.Wrap(err, "lsifStore.DocumentationDefinitions")
		}
		if len(locations) > 0 {
			r.path = locations[0].Path
			return r.adjustLocations(ctx, locations)
		}
	}
	return nil, nil
}
