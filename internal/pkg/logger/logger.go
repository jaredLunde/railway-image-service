package logger

import (
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/lmittmann/tint"
)

func New(opt Options, writers ...io.Writer) *slog.Logger {
	level := slog.LevelInfo

	switch opt.LogLevel {
	case LevelDebug:
		level = slog.LevelDebug
	case LevelWarn:
		level = slog.LevelWarn
	case LevelError:
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}

	writer := io.MultiWriter(append(writers, os.Stdout)...)

	var handler slog.Handler = tint.NewHandler(writer, &tint.Options{
		Level:      level,
		TimeFormat: time.Kitchen,
	})

	if !opt.Pretty {
		handler = slog.NewJSONHandler(writer, &slog.HandlerOptions{
			Level: level,
		})
	}

	return slog.New(handler)
}

type Options struct {
	Pretty   bool
	LogLevel LogLevel
}

type LogLevel string

const (
	LevelDebug LogLevel = "debug"
	LevelInfo  LogLevel = "info"
	LevelWarn  LogLevel = "warn"
	LevelError LogLevel = "error"
)
