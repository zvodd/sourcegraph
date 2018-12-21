package repos

import (
	"reflect"
	"strconv"
	"testing"
	"testing/quick"
)

func TestDiff(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
		a, b []Diffable
		diff Diff
	}{
		{
			name: "empty a and b",
			diff: Diff{},
		},
		{
			name: "added",
			b:    []Diffable{diffable{K: 1}},
			diff: Diff{Added: []Diffable{diffable{K: 1}}},
		},
		{
			name: "deleted",
			a:    []Diffable{diffable{K: 1}},
			diff: Diff{Deleted: []Diffable{diffable{K: 1}}},
		},
		{
			name: "modified",
			a:    []Diffable{diffable{K: 1, V: "foo"}},
			b:    []Diffable{diffable{K: 1, V: "bar"}},
			diff: Diff{Modified: []Diffable{diffable{K: 1, V: "bar"}}},
		},
		{
			name: "unmodified",
			a:    []Diffable{diffable{K: 1, V: "foo"}},
			b:    []Diffable{diffable{K: 1, V: "foo"}},
			diff: Diff{Unmodified: []Diffable{diffable{K: 1, V: "foo"}}},
		},
		{
			name: "duplicates in a", // last duplicate wins
			a:    []Diffable{diffable{K: 1, V: "foo"}, diffable{K: 1, V: "bar"}},
			diff: Diff{Deleted: []Diffable{diffable{K: 1, V: "bar"}}},
		},
		{
			name: "duplicates in b", // last duplicate wins
			b:    []Diffable{diffable{K: 1, V: "foo"}, diffable{K: 1, V: "bar"}},
			diff: Diff{Added: []Diffable{diffable{K: 1, V: "bar"}}},
		},
		{
			name: "sorting",
			a: []Diffable{
				diffable{K: 1, V: "foo"}, // deleted
				diffable{K: 2, V: "baz"}, // modified
				diffable{K: 1, V: "bar"}, // duplicate, deleted
				diffable{K: 3, V: "moo"}, // unmodified
				diffable{K: 0, V: "poo"}, // deleted
			},
			b: []Diffable{
				diffable{K: 5, V: "too"}, // added
				diffable{K: 4, V: "goo"}, // added
				diffable{K: 2, V: "boo"}, // modified
				diffable{K: 3, V: "moo"}, // unmodified
			},
			diff: Diff{
				Added: []Diffable{
					diffable{K: 4, V: "goo"},
					diffable{K: 5, V: "too"},
				},
				Deleted: []Diffable{
					diffable{K: 0, V: "poo"},
					diffable{K: 1, V: "bar"},
				},
				Modified: []Diffable{
					diffable{K: 2, V: "boo"},
				},
				Unmodified: []Diffable{
					diffable{K: 3, V: "moo"},
				},
			},
		},
	} {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			diff := NewDiff(tc.a, tc.b, func(a, b Diffable) bool {
				return reflect.DeepEqual(a, b)
			})

			if have, want := diff, tc.diff; !reflect.DeepEqual(have, want) {
				t.Errorf("Diff unexpected:\nhave %+v\nwant %+v", have, want)
			}
		})
	}

	isomorphism := func(a, b []diffable) bool {
		da := make([]Diffable, len(a))
		db := make([]Diffable, len(b))

		for i := range a {
			da[i] = &a[i]
		}

		for i := range b {
			db[i] = &b[i]
		}

		diff := NewDiff(da, db, func(a, b Diffable) bool {
			return reflect.DeepEqual(a, b)
		})

		difflen := len(diff.Added) + len(diff.Deleted) +
			len(diff.Modified) + len(diff.Unmodified)

		if len(a)+len(b) != difflen {
			t.Errorf("len(diff) != len(a) + len(b): missing elements")
			return false
		}

		hist := make(map[string]int, difflen)
		for _, diffables := range [][]Diffable{
			diff.Added,
			diff.Deleted,
			diff.Modified,
			diff.Unmodified,
		} {
			for _, d := range diffables {
				hist[d.ID()]++
			}
		}

		in := make([]Diffable, 0, len(a)+len(b))
		in = append(in, da...)
		in = append(in, db...)

		for _, d := range in {
			id := d.ID()
			if count := hist[id]; count != 1 {
				t.Errorf("%+v found %d times in %+v", id, count, diff)
				return false
			}
		}

		return true
	}

	if err := quick.Check(isomorphism, &quick.Config{MaxCount: 1000}); err != nil {
		t.Fatal(err)
	}
}

type diffable struct {
	K uint32
	V string
}

func (d diffable) ID() string {
	return strconv.FormatUint(uint64(d.K), 10)
}
