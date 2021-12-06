package observation

import (
	"github.com/opentracing/opentracing-go/log"
)

type Field struct {
	field log.Field
	sink  LogSink
}

type LogSink uint8

const (
	LogsSink  LogSink = 0
	TraceSink LogSink = 1 << iota
	HoneySink

	AllSink = TraceSink | LogsSink | HoneySink
)

// Bool adds a bool-valued key:value pair to a Span.LogFields() record
func Bool(key string, val bool) Field {
	return Field{log.Bool(key, val), AllSink}
}

// String adds a string-valued key:value pair to a Span.LogFields() record
func String(key string, val string) Field {
	return Field{log.String(key, val), AllSink}
}

// Int adds an int-valued key:value pair to a Span.LogFields() record
func Int(key string, val int) Field {
	return Field{log.Int(key, val), AllSink}
}

// Int32 adds an int32-valued key:value pair to a Span.LogFields() record
func Int32(key string, val int32) Field {
	return Field{log.Int32(key, val), AllSink}
}

// Int64 adds an int64-valued key:value pair to a Span.LogFields() record
func Int64(key string, val int64) Field {
	return Field{log.Int64(key, val), AllSink}
}

// Uint32 adds a uint32-valued key:value pair to a Span.LogFields() record
func Uint32(key string, val uint32) Field {
	return Field{log.Uint32(key, val), AllSink}
}

// Uint64 adds a uint64-valued key:value pair to a Span.LogFields() record
func Uint64(key string, val uint64) Field {
	return Field{log.Uint64(key, val), AllSink}
}

// Float32 adds a float32-valued key:value pair to a Span.LogFields() record
func Float32(key string, val float32) Field {
	return Field{log.Float32(key, val), AllSink}
}

// Float64 adds a float64-valued key:value pair to a Span.LogFields() record
func Float64(key string, val float64) Field {
	return Field{log.Float64(key, val), AllSink}
}

// Error adds an error with the key "error.object" to a Span.LogFields() record
func Error(err error) Field {
	return Field{log.Error(err), AllSink}
}

// Object adds an object-valued key:value pair to a Span.LogFields() record
// Please pass in an immutable object, otherwise there may be concurrency issues.
// Such as passing in the map, log.Object may result in "fatal error: concurrent map iteration and map write".
// Because span is sent asynchronously, it is possible that this map will also be modified.
func Object(key string, obj interface{}) Field {
	return Field{log.Object(key, obj), AllSink}
}

// Event creates a string-valued Field for span logs with key="event" and value=val.
func Event(val string) Field {
	return String("event", val)
}

// Message creates a string-valued Field for span logs with key="message" and value=val.
func Message(val string) Field {
	return String("message", val)
}

// Lazy adds a LazyLogger to a Span.LogFields() record; the tracing
// implementation will call the LazyLogger function at an indefinite time in
// the future (after Lazy() returns).
func Lazy(ll log.LazyLogger) Field {
	return Field{log.Lazy(ll), AllSink}
}

func (f Field) Exclude(sinks ...LogSink) Field {
	for _, exclusion := range sinks {
		f.sink = ^exclusion
	}

	return f
}

func (f Field) Key() string {
	return f.field.Key()
}

func (f Field) Value() interface{} {
	return f.field.Value()
}
