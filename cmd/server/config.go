package main

import (
	"time"

	"github.com/caarlos0/env/v11"
	"github.com/jaredLunde/railway-images/internal/pkg/logger"
)

type Config struct {
	Host        string `env:"HOST" envDefault:"[::]"`
	Port        int    `env:"PORT" envDefault:"3000"`
	CertFile    string `env:"CERT_FILE" envDefault:""`
	CertKeyFile string `env:"CERT_KEY_FILE" envDefault:""`

	// The maximum size of a request body in bytes
	MaxUploadSize int `env:"MAX_UPLOAD_SIZE" envDefault:"10485760"` // 10MB
	// The maximum duration for reading the entire request, including the body
	RequestTimeout time.Duration `env:"REQUEST_TIMEOUT" envDefault:"30s"`
	// The path to the directory where uploaded files are stored
	UploadPath string `env:"UPLOAD_PATH" envDefault:"./data/uploads"`
	// The path to the LevelDB database
	LevelDBPath string `env:"LEVELDB_PATH" envDefault:"./data/db"`
	// Used for signing URLs
	SignSecret string `env:"SIGN_SECRET" envDefault:"secret"`
	// Used for securing the key value storage API
	SecretKey string `env:"SECRET_KEY" envDefault:""`

	Environment Environment     `env:"ENVIRONMENT" envDefault:"production"`
	LogLevel    logger.LogLevel `env:"LOG_LEVEL" envDefault:"info"`
}

type Environment string

const (
	EnvironmentDevelopment Environment = "development"
	EnvironmentProduction  Environment = "production"
)

func LoadConfig() (cfg Config, err error) {
	cfg = Config{}
	if err = env.ParseWithOptions(&cfg, env.Options{RequiredIfNoDef: true}); err != nil {
		return
	}

	return
}
