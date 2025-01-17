package highlight

import (
	"html/template"

	"github.com/sourcegraph/sourcegraph/lib/codeintel/lsiftyped"
)

// Mocks is used to mock behavior in tests. Tests must call ResetMocks() when finished to ensure its
// mocks are not (inadvertently) used by subsequent tests.
//
// (The emptyMocks is used by ResetMocks to zero out Mocks without needing to use a named type.)
var Mocks, emptyMocks struct {
	Code func(p Params) (h template.HTML, l *lsiftyped.Document, aborted bool, err error)
}

// ResetMocks clears the mock functions set on Mocks (so that subsequent tests don't inadvertently
// use them).
func ResetMocks() {
	Mocks = emptyMocks
}
