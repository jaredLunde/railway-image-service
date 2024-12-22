package main

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cshum/imagor"
	"github.com/cshum/imagor/imagorpath"
	"github.com/cshum/imagor/loader/httploader"
	"github.com/cshum/imagor/server"
	"github.com/cshum/imagor/storage/filestorage"
	"github.com/cshum/imagor/vips"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/favicon"
	"github.com/gofiber/fiber/v3/middleware/healthcheck"
	"github.com/gofiber/fiber/v3/middleware/helmet"
	"github.com/gofiber/fiber/v3/middleware/proxy"
	fiberrecover "github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/gofiber/fiber/v3/middleware/requestid"
	"github.com/jaredLunde/railway-images/internal/pkg/mw"
	"go.uber.org/zap"
	"go.uber.org/zap/exp/zapslog"
	"go.uber.org/zap/zapcore"
)

func main() {
	ctx := context.Background()
	ctx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg, err := LoadConfig()
	if err != nil {
		panic(err)
	}
	zc := zapcore.NewCore(zapcore.NewJSONEncoder(
		zapcore.EncoderConfig{
			TimeKey:    "time",
			LevelKey:   "level",
			NameKey:    "logger",
			CallerKey:  "caller",
			MessageKey: "msg",
		},
	), os.Stdout, zapcore.InfoLevel)
	log := slog.New(zapslog.NewHandler(zc))
	zapLog := zap.New(zc)
	imagorService := imagor.New(
		imagor.WithLoaders(
			// s3storage.New(),
			// gcloudstorage.New(),
			filestorage.New(
				"./data",
				filestorage.WithPathPrefix("/file"),
				filestorage.WithSafeChars(""),
			),
			httploader.New(
				httploader.WithForwardClientHeaders(false),
				httploader.WithAccept("*/*"),
				httploader.WithForwardHeaders(""),
				httploader.WithOverrideResponseHeaders(""),
				httploader.WithAllowedSources("*"),
				httploader.WithAllowedSourceRegexps(""),
				httploader.WithMaxAllowedSize(20*1024*1024),
				httploader.WithInsecureSkipVerifyTransport(false),
				httploader.WithDefaultScheme("https"),
				httploader.WithBaseURL(""),
				httploader.WithProxyTransport("", ""),
				httploader.WithBlockLoopbackNetworks(false),
				httploader.WithBlockPrivateNetworks(false),
				httploader.WithBlockLinkLocalNetworks(false),
				httploader.WithBlockNetworks(),
			),
		),
		imagor.WithProcessors(vips.NewProcessor()),
		imagor.WithSigner(imagorpath.NewHMACSigner(sha256.New, 0, "")),
		imagor.WithBasePathRedirect(""),
		imagor.WithBaseParams(""),
		imagor.WithRequestTimeout(time.Second*30),
		imagor.WithLoadTimeout(time.Second*30),
		imagor.WithSaveTimeout(time.Second*30),
		imagor.WithProcessTimeout(time.Second*30),
		imagor.WithProcessConcurrency(20),
		imagor.WithProcessQueueSize(100),
		imagor.WithCacheHeaderTTL(time.Hour*24*7),
		imagor.WithCacheHeaderSWR(time.Hour*24),
		imagor.WithCacheHeaderNoCache(false),
		imagor.WithAutoWebP(true),
		imagor.WithAutoAVIF(true),
		imagor.WithModifiedTimeCheck(false),
		imagor.WithDisableErrorBody(false),
		imagor.WithDisableParamsEndpoint(false),
		imagor.WithResultStorages(filestorage.New("./tmp", filestorage.WithExpiration(time.Hour*24))),
		imagor.WithStoragePathStyle(imagorpath.DigestStorageHasher),
		imagor.WithResultStoragePathStyle(imagorpath.DigestResultStorageHasher),
		imagor.WithUnsafe(cfg.Environment == EnvironmentDevelopment),
		imagor.WithLogger(zapLog),
		imagor.WithDebug(cfg.Environment == EnvironmentDevelopment),
	)

	imagorServer := server.New(
		imagorService,
		server.WithAddr(net.JoinHostPort(cfg.Host, fmt.Sprint(cfg.ImagorPort))),
		server.WithPathPrefix("/get"),
		server.WithCORS(false),
		server.WithStripQueryString(false),
		server.WithAccessLog(true),
		server.WithLogger(zapLog),
		server.WithDebug(cfg.Environment == EnvironmentDevelopment),
		server.WithMetrics(nil),
	)

	appCtx, cancel := context.WithTimeout(ctx, imagorServer.StartupTimeout)
	defer cancel()

	if err := imagorServer.App.Startup(appCtx); err != nil {
		log.Error("imagor app failed to start", "error", err)
		os.Exit(1)
	}

	go func() {
		if imagorServer != nil {
			if err := imagorServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Error("imagor server failed to start", "error", err)
				os.Exit(1)
			}
		}
	}()

	objectsServer := fiber.New(fiber.Config{
		StrictRouting:      true,
		EnableIPValidation: true,
	})

	objectsServer.Use(mw.NewRealIP())
	objectsServer.Use(helmet.New(helmet.Config{HSTSPreloadEnabled: true, HSTSMaxAge: 31536000}))
	objectsServer.Use(fiberrecover.New(fiberrecover.Config{EnableStackTrace: cfg.Environment == EnvironmentDevelopment}))
	objectsServer.Use(favicon.New())
	objectsServer.Use(requestid.New())
	objectsServer.Use(mw.NewLogger(log, slog.LevelInfo))
	objectsServer.Get(mw.HealthCheckEndpoint, healthcheck.NewHealthChecker())
	objectsServer.Get("/get/*", func(c fiber.Ctx) error {
		forwardTo := fmt.Sprintf("http://localhost:%d%s", cfg.ImagorPort, c.Path())
		return proxy.DoTimeout(c, forwardTo, time.Second*30)
	})

	serverLog := log.With("source", "server")
	objectsServer.Use(mw.NewLogger(serverLog, slog.LevelInfo))

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
				log.Info("objects server shutdown successfully")
			},
		}

		log.Info("starting server", "address", addr, "environment", cfg.Environment)

		if err := objectsServer.Listen(addr, listenConfig); err != nil {
			log.Error("objects server failed to start", "error", err)
		}
	}()

	log.Info("servers are running", cfg.Host, cfg.Port)
	<-ctx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), imagorServer.ShutdownTimeout)
	if err := imagorServer.Shutdown(shutdownCtx); err != nil {
		log.Error("imagor server did not shutdown gracefully", "error", err)
		os.Exit(1)
	}

	log.Info("server shutdown gracefully")
}
