package repos

import "sort"

// A Diff of two sets of Diffables.
type Diff struct {
	Added      []Diffable
	Deleted    []Diffable
	Modified   []Diffable
	Unmodified []Diffable
}

// A Diffable can be diffed by the NewDiff function.
type Diffable interface {
	ID() string
}

// NewDiff returns a Diff of the two given sets of Diffables using the provided
// equality function to detect modified Diffables.
func NewDiff(a, b []Diffable, equal func(a, b Diffable) bool) (diff Diff) {
	sa := make(map[string]Diffable, len(a)) // set a
	for i := range a {
		sa[a[i].ID()] = a[i]
	}

	sb := make(map[string]Diffable, len(b)) // set b
	for i := range b {
		sb[b[i].ID()] = b[i]
	}

	for id, ra := range sa {
		switch rb, ok := sb[id]; {
		case !ok:
			diff.Deleted = append(diff.Deleted, ra)
		case !equal(ra, rb):
			diff.Modified = append(diff.Modified, rb)
		default:
			diff.Unmodified = append(diff.Unmodified, rb)
		}
	}

	for id, rb := range sb {
		if _, ok := sa[id]; !ok {
			diff.Added = append(diff.Added, rb)
		}
	}

	for _, ds := range [][]Diffable{
		diff.Added,
		diff.Deleted,
		diff.Modified,
		diff.Unmodified,
	} {
		sort.Slice(ds, func(i, j int) bool {
			return ds[i].ID() < ds[j].ID()
		})
	}

	return diff
}
