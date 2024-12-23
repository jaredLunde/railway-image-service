package imagor

import (
	"context"
	"crypto/sha256"
	"os"
	"time"

	i "github.com/cshum/imagor"
	"github.com/cshum/imagor/imagorpath"
	"github.com/cshum/imagor/loader/httploader"
	"github.com/cshum/imagor/storage/filestorage"
	"github.com/cshum/imagor/vips"
	"github.com/jaredLunde/railway-images/internal/app/keyval"
)

type Config struct {
	KeyVal        *keyval.KeyVal
	UploadPath    string
	MaxUploadSize int
	SignSecret    string
	Debug         bool
}

func New(ctx context.Context, cfg Config) (*i.Imagor, error) {
	tmpDir, err := os.MkdirTemp("", "imagor-*")
	if err != nil {
		return nil, err
	}

	loaders := []i.Loader{
		NewKVStorage(cfg.KeyVal, cfg.UploadPath),
		httploader.New(
			httploader.WithForwardClientHeaders(false),
			httploader.WithAccept("image/*"),
			httploader.WithForwardHeaders(""),
			httploader.WithOverrideResponseHeaders(""),
			httploader.WithAllowedSources("*"),
			httploader.WithAllowedSourceRegexps(""),
			httploader.WithMaxAllowedSize(cfg.MaxUploadSize),
			httploader.WithInsecureSkipVerifyTransport(false),
			httploader.WithDefaultScheme("https"),
			httploader.WithBaseURL(""),
			httploader.WithProxyTransport("", ""),
			httploader.WithBlockLoopbackNetworks(false),
			httploader.WithBlockPrivateNetworks(false),
			httploader.WithBlockLinkLocalNetworks(false),
			httploader.WithBlockNetworks(),
		),
	}

	// if false {
	// 	loaders = append(loaders, s3storage.New())
	// }
	// if false {
	// 	loaders = append(loaders, gcloudstorage.New())
	// }

	imagorService := i.New(
		i.WithLoaders(loaders...),
		i.WithProcessors(vips.NewProcessor()),
		i.WithSigner(imagorpath.NewHMACSigner(sha256.New, 0, cfg.SignSecret)),
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
		i.WithDisableParamsEndpoint(true),
		i.WithResultStorages(filestorage.New(tmpDir, filestorage.WithExpiration(time.Hour*24))),
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
