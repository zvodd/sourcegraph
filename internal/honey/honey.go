// package honey is a lightweight wrapper around libhoney which initializes
// honeycomb based on environment variables.
package honey

import (
	"context"
	"log"
	"os"

	"github.com/sourcegraph/sourcegraph/internal/env"

	"github.com/honeycombio/libhoney-go"
)

var apiKey = env.Get("HONEYCOMB_TEAM", "", "The key used for Honeycomb event tracking.")

var honeyKey = struct{}{}

// Enabled returns true if honeycomb has been configured to run.
func Enabled() bool {
	return apiKey != ""
}

// Event creates an event for logging to dataset. Event.Send will only work if
// Enabled() returns true.
func Event(dataset string) *libhoney.Event {
	ev := libhoney.NewEvent()
	ev.Dataset = dataset
	return ev
}

// Builder creates a builder for logging to a dataset.
func Builder(dataset string) *libhoney.Builder {
	b := libhoney.NewBuilder()
	b.Dataset = dataset
	return b
}

// NewIntoContext creates a new event, places it into the context and returns both
func NewIntoContext(ctx context.Context, builder *libhoney.Builder) (*libhoney.Event, context.Context) {
	event := builder.NewEvent()
	return event, IntoContext(ctx, event)
}

// IntoContext adds a *libhoney.Event into a context.Context, and returns the context.
func IntoContext(ctx context.Context, event *libhoney.Event) context.Context {
	return context.WithValue(ctx, honeyKey, event)
}

func FromContext(ctx context.Context) *libhoney.Event {
	event := ctx.Value(honeyKey)
	if event != nil {
		return event.(*libhoney.Event)
	}
	return nil
}

func init() {
	if apiKey == "" {
		return
	}
	err := libhoney.Init(libhoney.Config{
		APIKey: apiKey,
		//Logger: &Logger{},
	})
	if err != nil {
		log.Println("Failed to init libhoney:", err)
		apiKey = ""
		return
	}
	// HOSTNAME is the name of the pod on kubernetes.
	if h := os.Getenv("HOSTNAME"); h != "" {
		libhoney.AddField("pod_name", h)
	}
}
