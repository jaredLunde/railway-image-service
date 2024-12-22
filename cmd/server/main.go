package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"github.com/gofiber/fiber/v3/middleware/favicon"
	"github.com/gofiber/fiber/v3/middleware/healthcheck"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	fiberrecover "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/jaredLunde/railway-images/internal/app/imagor"
	"github.com/jaredLunde/railway-images/internal/pkg/logger"
	"github.com/jaredLunde/railway-images/internal/pkg/mw"
)

func main() {
	ctx := context.Background()
	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}

	log := logger.New(logger.Options{
		LogLevel: cfg.LogLevel,
		Pretty:   cfg.Environment == EnvironmentDevelopment,
	})

	imagorService, err := imagor.NewService(ctx, &imagor.Config{
		Debug: cfg.Environment == EnvironmentDevelopment,
	})
	if err != nil {
		log.Error("imagor app failed to start", "error", err)
		os.Exit(1)
	}

	app := fiber.New(fiber.Config{
		StrictRouting:      true,
		EnableIPValidation: true,
	})

	app.Use(mw.NewRealIP())
	app.Use(helmet.New(helmet.Config{HSTSPreloadEnabled: true, HSTSMaxAge: 31536000}))
	app.Use(fiberrecover.New(fiberrecover.Config{EnableStackTrace: cfg.Environment == EnvironmentDevelopment}))
	app.Use(favicon.New())
	app.Use(requestid.New())
	app.Use(mw.NewLogger(log, slog.LevelInfo))
	app.Get(mw.HealthCheckEndpoint, healthcheck.NewHealthChecker())
	app.Get("/format/*", adaptor.HTTPHandler(http.StripPrefix("/format", imagorService)))

	serverLog := log.With("source", "server")
	app.Use(mw.NewLogger(serverLog, slog.LevelInfo))

	go func() {
		addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		listenConfig := fiber.ListenConfig{
			GracefulContext:       ctx,
			ListenerNetwork:       fiber.NetworkTCP,
			DisableStartupMessage: true,
			CertFile:              cfg.CertFile,
			CertKeyFile:           cfg.CertKeyFile,
			OnShutdownError: func(err error) {
				log.Error("error shutting down objects server", "error", err)
			},
			OnShutdownSuccess: func() {
				if err := imagorService.Shutdown(ctx); err != nil {
					log.Error("imagor service did not shutdown gracefully", "error", err)
				}

				log.Info("objects server shutdown successfully")
			},
		}

		log.Info("starting server", "address", addr, "environment", cfg.Environment)

		if err := app.Listen(addr, listenConfig); err != nil {
			log.Error("objects server failed to start", "error", err)
		}
	}()

	log.Info("servers are running", cfg.Host, cfg.Port)
	<-ctx.Done()

	log.Info("server shutdown gracefully")
}
