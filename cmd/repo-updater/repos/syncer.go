package repos

import (
	"context"
	"time"

	log15 "gopkg.in/inconshreveable/log15.v2"
)

// A Syncer periodically synchronizes available repositories from all its given Sources
// with the stored Repositories in Sourcegraph.
type Syncer struct {
	interval time.Duration
	source   Source
	store    Store
	now      func() time.Time
}

// NewSyncer returns a new Syncer with the given parameters.
func NewSyncer(interval time.Duration, store Store, sources []Source, now func() time.Time) *Syncer {
	return &Syncer{
		interval: interval,
		source:   NewSources(sources...),
		store:    store,
		now:      now,
	}
}

// Run runs the Syncer at its specified interval.
func (s Syncer) Run(ctx context.Context) error {
	ticks := time.NewTicker(s.interval)
	defer ticks.Stop()

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticks.C:
			if err := s.sync(ctx); err != nil {
				log15.Error("Syncer", "err", err)
			}
		}
	}
}

func (s Syncer) sync(ctx context.Context) error {
	sourced, err := s.source.ListRepos(ctx)
	if err != nil {
		return err
	}

	stored, err := s.store.ListRepos(ctx)
	if err != nil {
		return err
	}

	return s.store.UpsertRepos(
		ctx,
		s.upserts(sourced, stored)...,
	)
	// TODO(tsenart): ensure scheduler picks up changes to be propagated to git server
	// TODO(tsenart): ensure search index gets updated too
}

func (s Syncer) upserts(sourced, stored []*Repo) []*Repo {
	a := make([]Diffable, len(sourced))
	for i := range sourced {
		a[i] = sourced[i]
	}

	b := make([]Diffable, len(stored))
	for i := range stored {
		b[i] = stored[i]
	}

	diff := NewDiff(a, b, func(a, b Diffable) bool {
		return a.(*Repo).Equal(b.(*Repo))
	})

	now := s.now()
	upserts := make([]*Repo, 0, len(diff.Added)+len(diff.Deleted)+len(diff.Modified))

	for _, add := range diff.Added {
		repo := add.(*Repo)
		repo.CreatedAt = now
		upserts = append(upserts, repo)
	}

	for _, mod := range diff.Modified {
		repo := mod.(*Repo)
		repo.UpdatedAt = now
		upserts = append(upserts, repo)
	}

	// TODO(tsenart): Protect against unintended deleted due to transient sourcing errors.
	for _, del := range diff.Modified {
		repo := del.(*Repo)
		repo.DeletedAt = now
		upserts = append(upserts, repo)
	}

	return upserts
}
