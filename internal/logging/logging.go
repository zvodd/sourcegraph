package logging

import (
	"context"

	"github.com/inconshreveable/log15"

	"github.com/sourcegraph/sourcegraph/internal/trace"
)

// ErrorLogger captures the method required for logging an error.
type ErrorLogger interface {
	Error(msg string, ctx ...interface{})
}

type ErrorContextLogger interface {
	Error(c context.Context, msg string, ctx ...interface{})
}

var _ ErrorContextLogger = &Logger{}

// Log logs the given message and context when the given error is defined.
func Log(lg ErrorLogger, msg string, err *error, ctx ...interface{}) {
	if lg == nil || err == nil || *err == nil {
		return
	}

	lg.Error(msg, append(append(make([]interface{}, 0, 2+len(ctx)), "error", *err), ctx...)...)
}

// Log logs the given message and context when the given error is defined.
func LogCtx(lg ErrorContextLogger, c context.Context, msg string, err *error, ctx ...interface{}) {
	if lg == nil || err == nil || *err == nil {
		return
	}

	lg.Error(c, msg, append(append(make([]interface{}, 0, 2+len(ctx)), "error", *err), ctx...)...)
}

type ctxKey struct{}

type Logger struct {
	logger log15.Logger
	en     []Enricher
}

type Enricher func(context.Context) []interface{}

func WithTraceID() Enricher {
	return func(c context.Context) []interface{} {
		traceID := trace.ID(c)
		if traceID != "" {
			return []interface{}{"traceID", traceID}
		}
		return nil
	}
}

func New(logger log15.Logger, enrichers ...Enricher) *Logger {
	return &Logger{
		logger: logger,
		en:     enrichers,
	}
}

func WithLogger(ctx context.Context, logger *Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, logger)
}

func Get(ctx context.Context) *Logger {
	if l, ok := ctx.Value(ctxKey{}).(*Logger); ok {
		return l
	}
	return New(log15.Root())
}

func (l *Logger) Debug(c context.Context, msg string, ctx ...interface{}) {
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Debug(msg, ctx...)
}

func (l *Logger) Info(c context.Context, msg string, ctx ...interface{}) {
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Info(msg, ctx...)
}

func (l *Logger) Warn(c context.Context, msg string, ctx ...interface{}) {
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Warn(msg, ctx...)
}

func (l *Logger) Error(c context.Context, msg string, ctx ...interface{}) {
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Error(msg, ctx...)
}

func (l *Logger) Crit(c context.Context, msg string, ctx ...interface{}) {
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Crit(msg, ctx...)
}

func Debug(c context.Context, msg string, ctx ...interface{}) {
	l := Get(c)
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Debug(msg, ctx...)
}

func Info(c context.Context, msg string, ctx ...interface{}) {
	l := Get(c)
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Info(msg, ctx...)
}

func Warn(c context.Context, msg string, ctx ...interface{}) {
	l := Get(c)
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Warn(msg, ctx...)
}

func Error(c context.Context, msg string, ctx ...interface{}) {
	l := Get(c)
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Error(msg, ctx...)
}

func Crit(c context.Context, msg string, ctx ...interface{}) {
	l := Get(c)
	for _, fn := range l.en {
		ctx = append(ctx, fn(c)...)
	}

	l.logger.Crit(msg, ctx...)
}
