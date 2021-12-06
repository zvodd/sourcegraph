package repoupdater

import (
	"context"

	"github.com/sourcegraph/sourcegraph/internal/api"
	obsv "github.com/sourcegraph/sourcegraph/internal/observation"
	"github.com/sourcegraph/sourcegraph/internal/repoupdater"
	"github.com/sourcegraph/sourcegraph/internal/repoupdater/protocol"
)

type Client struct {
	operations *operations
}

func New(observationContext *obsv.Context) *Client {
	return &Client{
		operations: newOperations(observationContext),
	}
}

func (c *Client) RepoLookup(ctx context.Context, name api.RepoName) (repo *protocol.RepoInfo, err error) {
	ctx, endObservation := c.operations.repoLookup.With(ctx, &err, obsv.Args{LogFields: []obsv.Field{}})
	defer func() {
		var logFields []obsv.Field
		if repo != nil {
			logFields = []obsv.Field{obsv.Int("repoID", int(repo.ID))}
		}
		endObservation(1, obsv.Args{LogFields: logFields})
	}()

	result, err := repoupdater.DefaultClient.RepoLookup(ctx, protocol.RepoLookupArgs{Repo: name})
	if err != nil {
		return nil, err
	}

	return result.Repo, nil
}

func (c *Client) EnqueueRepoUpdate(ctx context.Context, name api.RepoName) (resp *protocol.RepoUpdateResponse, err error) {
	ctx, endObservation := c.operations.enqueueRepoUpdate.With(ctx, &err, obsv.Args{LogFields: []obsv.Field{}})
	defer func() {
		var logFields []obsv.Field
		if resp != nil {
			logFields = []obsv.Field{obsv.Int("repoID", int(resp.ID))}
		}
		endObservation(1, obsv.Args{LogFields: logFields})
	}()

	resp, err = repoupdater.DefaultClient.EnqueueRepoUpdate(ctx, name)
	return
}
