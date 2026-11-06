package config

import (
	"errors"
	"net"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL string
	JWTSecret   []byte
	ListenAddr  string
}

// This repository provides a development slice, not a production deployment.
// Refuse an implicit environment and never ship default credentials.
func Load() (Config, error) {
	if os.Getenv("NEXORA_ENV") != "development" {
		return Config{}, errors.New("set NEXORA_ENV=development; production deployment is not yet supported")
	}
	db := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	key := os.Getenv("NEXORA_JWT_SECRET")
	if db == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if len(key) < 32 {
		return Config{}, errors.New("NEXORA_JWT_SECRET must contain at least 32 bytes of randomly generated secret")
	}
	addr := os.Getenv("NEXORA_LISTEN_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8080"
	}
	if _, _, err := net.SplitHostPort(addr); err != nil {
		return Config{}, errors.New("NEXORA_LISTEN_ADDR must be host:port")
	}
	return Config{DatabaseURL: db, JWTSecret: []byte(key), ListenAddr: addr}, nil
}
