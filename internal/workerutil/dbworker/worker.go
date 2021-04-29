package dbworker

import (
	"context"

	"github.com/sourcegraph/sourcegraph/internal/honey"
	"github.com/sourcegraph/sourcegraph/internal/observation"

	"github.com/sourcegraph/sourcegraph/internal/trace"

	"github.com/inconshreveable/log15"
	"github.com/opentracing/opentracing-go"
	"github.com/prometheus/client_golang/prometheus"

	"github.com/sourcegraph/sourcegraph/internal/workerutil"
	"github.com/sourcegraph/sourcegraph/internal/workerutil/dbworker/store"
)

func NewWorker(ctx context.Context, store store.Store, handler Handler, options workerutil.WorkerOptions) *workerutil.Worker {
	honey := honey.Builder("_")
	honey.SampleRate = 0
	observationContext := &observation.Context{
		Logger:     log15.Root(),
		Tracer:     &trace.Tracer{Tracer: opentracing.GlobalTracer()},
		Registerer: prometheus.DefaultRegisterer,
		Honeycomb:  honey,
	}
	return workerutil.NewWorker(ctx, newStoreShim(store), newHandlerShim(handler), options, observationContext)
}
