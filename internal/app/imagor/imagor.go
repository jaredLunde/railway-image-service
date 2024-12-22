package imagor

import (
	"context"
	"crypto/sha256"
	"time"

	i "github.com/cshum/imagor"
	"github.com/cshum/imagor/imagorpath"
	"github.com/cshum/imagor/loader/httploader"
	"github.com/cshum/imagor/storage/filestorage"
	"github.com/cshum/imagor/vips"
)

type Config struct {
	UploadVolume string
	Debug        bool
}

func NewService(ctx context.Context, cfg Config) (*i.Imagor, error) {
	imagorService := i.New(
		i.WithLoaders(
			// s3storage.New(),
			// gcloudstorage.New(),
			filestorage.New(
				cfg.UploadVolume,
				filestorage.WithPathPrefix("/file"),
				filestorage.WithSafeChars(""),
			),
			httploader.New(
				httploader.WithForwardClientHeaders(false),
				httploader.WithAccept("image/*"),
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
		i.WithProcessors(vips.NewProcessor()),
		i.WithSigner(imagorpath.NewHMACSigner(sha256.New, 0, "")),
		i.WithBasePathRedirect(""),
		i.WithBaseParams(""),
		i.WithRequestTimeout(time.Second*30),
		i.WithLoadTimeout(time.Second*30),
		i.WithSaveTimeout(time.Second*30),
		i.WithProcessTimeout(time.Second*30),
		i.WithProcessConcurrency(20),
		i.WithProcessQueueSize(100),
		i.WithCacheHeaderTTL(time.Hour*24*7),
		i.WithCacheHeaderSWR(time.Hour*24),
		i.WithCacheHeaderNoCache(false),
		i.WithAutoWebP(true),
		i.WithAutoAVIF(true),
		i.WithModifiedTimeCheck(false),
		i.WithDisableErrorBody(false),
		i.WithDisableParamsEndpoint(false),
		i.WithResultStorages(filestorage.New("./tmp", filestorage.WithExpiration(time.Hour*24))),
		i.WithStoragePathStyle(imagorpath.DigestStorageHasher),
		i.WithResultStoragePathStyle(imagorpath.DigestResultStorageHasher),
		i.WithUnsafe(cfg.Debug),
		i.WithDebug(cfg.Debug),
	)

	appCtx, cancel := context.WithTimeout(ctx, time.Second*10)
	defer cancel()

	if err := imagorService.Startup(appCtx); err != nil {
		return nil, err
	}

	return imagorService, nil
}
