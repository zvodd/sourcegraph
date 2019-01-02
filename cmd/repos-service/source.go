package main

import (
	"context"

	log15 "gopkg.in/inconshreveable/log15.v2"
)

// A Source yields repositories to be stored and analysed by Sourcegraph.
// Successive calls to its ListRepos method may yield different results.
type Source interface {
	ListRepos(context.Context) ([]*Repo, error)
}

// NewSources returns a Source which is the composition of all the given Sources.
// Errors returned by any of the Sources are logged and ignored, so the returned Source never
// fails.
func NewSources(srcs ...Source) Source {
	return &sources{srcs: srcs}
}

type sources struct{ srcs []Source }

// ListRepos implements the Source interface.
func (s sources) ListRepos(ctx context.Context) ([]*Repo, error) {
	type result struct {
		src   Source
		repos []*Repo
		err   error
	}

	ch := make(chan result, len(s.srcs))
	for _, src := range s.srcs {
		go func(src Source) {
			if repos, err := src.ListRepos(ctx); err != nil {
				ch <- result{src: src, err: err}
			} else {
				ch <- result{src: src, repos: repos}
			}
		}(src)
	}

	var repos []*Repo
	for i := 0; i < len(ch); i++ {
		if r := <-ch; r.err != nil {
			log15.Error("sources", "err", r.err)
		} else {
			repos = append(repos, r.repos...)
		}
	}

	return repos, nil
}
