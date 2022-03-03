package graphql

import (
	"context"

	gql "github.com/sourcegraph/sourcegraph/cmd/frontend/graphqlbackend"
	"github.com/sourcegraph/sourcegraph/enterprise/cmd/frontend/internal/codeintel/resolvers"
	"github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/internal/types"
)

type codeIntelTreeInfoResolver struct {
	resolver  resolvers.Resolver
	paths     []string
	repo      *types.Repo
	errTracer *observation.ErrCollector
}

func NewCodeIntelTreeInfoResolver(resolver resolvers.Resolver, paths []string, repo *types.Repo, errTracer *observation.ErrCollector) gql.CodeIntelInfoResolver {
	return &codeIntelTreeInfoResolver{resolver: resolver, paths: paths, repo: repo, errTracer: errTracer}
}

func (r *codeIntelTreeInfoResolver) NumFiles(ctx context.Context) int32 {
	return int32(len(r.paths))
}

func (r *codeIntelTreeInfoResolver) CoveredPaths(ctx context.Context) *[]string {
	return &r.paths
}

func (r *codeIntelTreeInfoResolver) Support(ctx context.Context) gql.CodeIntelSupportResolver {
	return NewCodeIntelSupportResolver(r.resolver, r.repo.Name, r.paths[0], r.errTracer)
}
