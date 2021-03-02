package search

import (
	regexpsyntax "regexp/syntax"
	"strings"

	"github.com/sourcegraph/sourcegraph/internal/search/query"
)

type Environment struct {
	DotCom            bool
	VersionContext    string
	DefaultRepoLabels []RepoLabel
}

func unionRegExps(patterns []string) string {
	if len(patterns) == 0 {
		return ""
	}
	if len(patterns) == 1 {
		return patterns[0]
	}

	// We only need to wrap the pattern in parentheses if it contains a "|" because
	// "|" has the lowest precedence of any operator.
	patterns2 := make([]string, len(patterns))
	for i, p := range patterns {
		if strings.Contains(p, "|") {
			p = "(" + p + ")"
		}
		patterns2[i] = p
	}
	return strings.Join(patterns2, "|")
}

// Cf. golang/go/src/regexp/syntax/parse.go.
const regexpFlags = regexpsyntax.ClassNL | regexpsyntax.PerlX | regexpsyntax.UnicodeGroups

// ExactlyOneRepo returns whether exactly one repo: literal field is specified and
// delineated by regex anchors ^ and $. This function helps determine whether we
// should return results for a single repo regardless of whether it is a fork or
// archive.
func ExactlyOneRepo(repoFilters []string) bool {
	if len(repoFilters) == 1 {
		filter, _ := ParseRepositoryRevisions(repoFilters[0])
		if strings.HasPrefix(filter, "^") && strings.HasSuffix(filter, "$") {
			filter := strings.TrimSuffix(strings.TrimPrefix(filter, "^"), "$")
			r, err := regexpsyntax.Parse(filter, regexpFlags)
			if err != nil {
				return false
			}
			return r.Op == regexpsyntax.OpLiteral
		}
	}
	return false
}

func mapLabels(labels []RepoLabel, callback func(name RepoLabelName, negated bool) *RepoLabel) []RepoLabel {
	var newLabels []RepoLabel
	for _, label := range labels {
		if v := callback(label.name, label.negated); v != nil {
			newLabels = append(newLabels, *v)
		}
	}
	return newLabels
}

func removeLabel(labels []RepoLabel, wantName RepoLabelName) []RepoLabel {
	return mapLabels(labels, func(name RepoLabelName, negated bool) *RepoLabel {
		if name == wantName {
			return nil
		}
		return &RepoLabel{name, negated}
	})
}

func removeNegatedLabel(labels []RepoLabel, wantName RepoLabelName) []RepoLabel {
	return mapLabels(labels, func(name RepoLabelName, negated bool) *RepoLabel {
		if name == wantName && negated {
			return nil
		}
		return &RepoLabel{name, negated}
	})
}

/*

compare:

https://sourcegraph.com/github.com/sourcegraph/sourcegraph/-/blob/cmd/frontend/graphqlbackend/search.go#L430


https://sourcegraph.com/github.com/sourcegraph/sourcegraph@4454858dce1207a06542e51de875a2c3bdea50fe/-/blob/internal/database/repos.go#L1158-1180


https://sourcegraph.com/github.com/sourcegraph/sourcegraph@4454858dce1207a06542e51de875a2c3bdea50fe/-/blob/cmd/frontend/internal/search/repos/repos.go#L118

*/

func toRepoOptions(q query.Q) *RepoOptions {
	defaults := []RepoLabel{
		RepoLabel{name: UniversalLabel, negated: false},
		RepoLabel{name: Fork, negated: true},
		RepoLabel{name: Archive, negated: true},
	}

	includeRepos, excludeRepos := query.FindFields(q, "repo")
	includeRepoGroups := query.FindPositiveField(q, "repogroup")             // enforce singular, isNotNegated
	fork := query.ParseYesNoOnly(query.FindPositiveField(q, "fork"))         // enforce singular
	archived := query.ParseYesNoOnly(query.FindPositiveField(q, "archived")) // enforce singular
	privacy := ParseVisibility(query.FindPositiveField(q, "visibility"))     // ... etc.
	// TODO: deal with repoHasCommitAfter. / commitAfter

	switch fork {
	case query.Yes:
		defaults = removeNegatedLabel(defaults, Fork)
	case query.Only:
		defaults = append(removeLabel(removeLabel(defaults, UniversalLabel), Fork), RepoLabel{name: Fork, negated: false})
	}

	switch archived {
	case query.Yes:
		defaults = removeNegatedLabel(defaults, Archive)
	case query.Only:
		defaults = append(removeLabel(removeLabel(defaults, UniversalLabel), Archive), RepoLabel{name: Archive, negated: false})
	}

	return &RepoOptions{
		includeRepos:     includeRepos,
		excludeRepos:     unionRegExps(excludeRepos),
		includeRepoGroup: includeRepoGroups,
		labels:           defaults,
	}
}

// TODO: send this the version context URL param and ennvar.
func translate(q query.Q, env Environment) InternalQuery {
	repoOptions := toRepoOptions(q)
	//	contextID := FindPositiveField(q, "context")

	/*
		if repoQuery, ok := toRepoQuery(q); ok {
			if env.DotCom {
				return RepoQuery{DotComDefault{}}
			}
			return repoQuery
		}
	*/
	return GenericQuery{q}
}
