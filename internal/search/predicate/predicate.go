package predicate

import (
	"fmt"
	"regexp"

	"github.com/sourcegraph/sourcegraph/internal/search/query"
)

var (
	predicateRegexp = regexp.MustCompile(`^(?P<name>[a-z]+)\((?P<params>.*)\)$`)
	nameIndex       = predicateRegexp.SubexpIndex("name")
	paramsIndex     = predicateRegexp.SubexpIndex("params")
)

// ParseAsPredicate attempts to parse a value as a predicate. It does not validate
// that the parsed predicate is a defined predicate.
func ParseAsPredicate(value string) (name, params string, err error) {
	match := predicateRegexp.FindStringSubmatch(value)
	if match == nil {
		return "", "", fmt.Errorf("value '%s' is not a predicate", value)
	}

	name = match[nameIndex]
	params = match[paramsIndex]
	return name, params, nil
}

type registry map[string]map[string]P

var Registry = registry{
	query.FieldRepo: {
		"contains": &RepoContains{},
	},
}

// Get returns a predicate for the given field with the given name. If no such predicate
// exists, or the params provided are invalid, it returns an error.
func (r registry) Get(field, name, params string) (P, error) {
	fieldPredicates, ok := query.AllPredicates[field]
	if !ok {
		return nil, fmt.Errorf("no predicates registered for field %s", field)
	}

	_, ok = fieldPredicates[name]
	if !ok {
		return nil, fmt.Errorf("field '%s' has no predicate named '%s'", field, name)
	}

	predicate, ok := r[field][name]
	if !ok {
		return nil, fmt.Errorf("predicate '%s' recognized for field '%s' but not in registry. Did you forget to add it to the registry?", name, field)
	}
	if err := predicate.ParseParams(params); err != nil {
		return nil, fmt.Errorf("failed to parse params: %s", err)
	}
	return predicate, nil
}
