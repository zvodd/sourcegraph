package search

import "github.com/sourcegraph/sourcegraph/internal/search/query"

type RepoVisibility string

const (
	UniversalVisibility RepoVisibility = "UniversalVisibility"
	Private             RepoVisibility = "private"
	Public              RepoVisibility = "public"
)

type RepoLabelName string

const (
	UniversalLabel RepoLabelName = "UniversalLabel"
	Fork           RepoLabelName = "fork"
	Archive        RepoLabelName = "archive"
)

type RepoLabel struct {
	name    RepoLabelName
	negated bool
}

type RepoOptions struct {
	includeRepos     []string
	includeRepoGroup string
	excludeRepos     string
	visibility       []RepoVisibility
	labels           []RepoLabel
}

/* RepoSetID variants */
type RepoSetID interface {
	RepoSetIDValue()
}

func (VersionContext) RepoSetIDValue() {}
func (Context) RepoSetIDValue()        {}

type VersionContext struct {
	ID string
}

type Context struct {
	ID string
}

/* RepoSet variants */
type RepoSet interface {
	RepoSetValue()
}

func (DotComDefault) RepoSetValue() {}
func (GlobalSet) RepoSetValue()     {}
func (LabeledSubset) RepoSetValue() {}
func (Subset) RepoSetValue()        {}
func (Single) RepoSetValue()        {}

type DotComDefault struct {
	RepoOptions
}

type GlobalSet struct {
	RepoOptions
}

type LabeledSubset struct {
	RepoSetID
	RepoOptions
}

type Subset struct {
	RepoOptions
}

type Single struct {
	RepoOptions
}

/* Internal Query */
type InternalQuery interface {
	internalQueryValue()
}

func (RepoQuery) internalQueryValue()    {}
func (GenericQuery) internalQueryValue() {}

type RepoQuery struct {
	RepoSet
}

type GenericQuery struct {
	query.Q
}
