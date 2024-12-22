package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/goccy/go-json"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/adaptor"
	"github.com/gofiber/fiber/v3/middleware/favicon"
	"github.com/gofiber/fiber/v3/middleware/healthcheck"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	fiberrecover "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/jaredLunde/railway-images/internal/app/imagor"
	"github.com/jaredLunde/railway-images/internal/app/keyval"
	"github.com/jaredLunde/railway-images/internal/pkg/logger"
	"github.com/jaredLunde/railway-images/internal/pkg/mw"
	"golang.org/x/sync/errgroup"
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

	kvService, err := keyval.New(keyval.Config{
		UploadPath:  cfg.UploadPath,
		LevelDBPath: cfg.LevelDBPath,
		SoftDelete:  true,
		Logger:      log,
	})
	if err != nil {
		log.Error("keyval app failed to start", "error", err)
		os.Exit(1)
	}
	defer kvService.Close()

	imagorService, err := imagor.New(ctx, imagor.Config{
		KeyVal:        kvService,
		UploadPath:    cfg.UploadPath,
		MaxUploadSize: cfg.MaxUploadSize,
		Debug:         cfg.Environment == EnvironmentDevelopment,
	})
	if err != nil {
		log.Error("imagor app failed to start", "error", err)
		os.Exit(1)
	}

	app := fiber.New(fiber.Config{
		StrictRouting:     true,
		BodyLimit:         cfg.MaxUploadSize,
		WriteTimeout:      cfg.RequestTimeout,
		ReadTimeout:       cfg.RequestTimeout,
		StreamRequestBody: true,
		ReduceMemoryUsage: true, // memory costs money brah, i'm a poor
		JSONEncoder:       json.Marshal,
		JSONDecoder:       json.Unmarshal,
	})

	app.Use(mw.NewRealIP())
	app.Use(helmet.New(helmet.Config{HSTSPreloadEnabled: true, HSTSMaxAge: 31536000}))
	app.Use(fiberrecover.New(fiberrecover.Config{EnableStackTrace: cfg.Environment == EnvironmentDevelopment}))
	app.Use(favicon.New())
	app.Use(requestid.New())
	app.Get(mw.HealthCheckEndpoint, healthcheck.NewHealthChecker())
	app.Use(mw.NewLogger(log.With("source", "http"), slog.LevelInfo))
	app.Get("/format/*", adaptor.HTTPHandler(http.StripPrefix("/format", imagorService)))
	app.Get("/files", kvService.ServeHTTP)
	app.All("/files/*", kvService.ServeHTTP)

	g := errgroup.Group{}
	g.Go(func() error {
		addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
		listenerNetwork := fiber.NetworkTCP4
		if cfg.Host == "[::]" {
			listenerNetwork = fiber.NetworkTCP6
		}
		// NOTE: We cannot use prefork because LevelDB uses a single file lock
		listenConfig := fiber.ListenConfig{
			GracefulContext:       ctx,
			ListenerNetwork:       listenerNetwork,
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

				log.Info("server shutdown successfully")
			},
		}

		log.Info("starting server", "address", addr, "environment", cfg.Environment)
		if err := app.Listen(addr, listenConfig); err != nil {
			return err
		}

		return nil
	})

	if err := g.Wait(); err != nil {
		log.Error("error starting application", "error", err)
		os.Exit(1)
	}

	<-ctx.Done()
	log.Info("exit 0")
}
