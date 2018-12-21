package repos

import (
	"time"

	"github.com/sourcegraph/sourcegraph/pkg/api"
)

// Repo represents a source code repository stored in Sourcegraph.
type Repo struct {
	// ID is the unique numeric ID for this repository.
	_ID int32
	// Name is the name for this repository (e.g., "github.com/user/repo").
	//
	// Previously, this was called RepoURI.
	Name api.RepoName
	// Language is the primary programming language used in this repository.
	Language string
	// Fork is whether this repository is a fork of another repository.
	Fork bool
	// Enabled is whether the repository is enabled. Disabled repositories are
	// not accessible by users (except site admins).
	Enabled bool
	// Archived is whether the repository has been archived.
	Archived bool
	// CreatedAt is when this repository was created on Sourcegraph.
	CreatedAt time.Time
	// UpdatedAt is when this repository's metadata was last updated on Sourcegraph.
	UpdatedAt *time.Time
	// DeletedAt is when this repository was soft-deleted from Sourcegraph.
	DeletedAt *time.Time
	// Description is a brief description of the repository.
	Description string
	// ExternalRepo identifies this repository by its ID on the external service where it resides (and the external
	// service itself).
	ExternalRepo api.ExternalRepoSpec
}

// ID returns a globally unique identifier of the repository.
func (r *Repo) ID() string {
	return r.ExternalRepo.ServiceType + ":" + r.ExternalRepo.ServiceID + ":" + r.ExternalRepo.ID
}

// Equal performs a deep equality comparison of r with other.
func (r *Repo) Equal(other *Repo) bool {
	return r == other || (r != nil && other != nil &&
		r.Name == other.Name &&
		r.Description == other.Description &&
		r.Fork == other.Fork &&
		r.Archived == other.Archived &&
		r.Enabled == other.Enabled &&
		r.ExternalRepo == other.ExternalRepo)
}
