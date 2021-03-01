package query

type RepoVisibility string

const (
	AnyPrivacy RepoVisibility = "anyPrivacy"
	Private    RepoVisibility = "private"
	Public     RepoVisibility = "public"
)

type RepoState string

const (
	Indexed    RepoState = "indexed"
	NotIndexed RepoState = "notIndexed"
)

type RepoLabelName string

const (
	AnyLabel RepoLabelName = "anyLabel"
	Fork     RepoLabelName = "fork"
	Archive  RepoLabelName = "archive"
)

type RepoLabel struct {
	name    RepoLabelName
	negated bool
}

type RepoOptions struct {
	visibility      []RepoVisibility
	state           []RepoState
	label           []RepoLabel
	includePatterns []string
	excludePattern  string
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
	Q
}
