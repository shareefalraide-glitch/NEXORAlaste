package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"nexora.local/nexora/services/api/internal/api"
	"nexora.local/nexora/services/api/internal/config"
	"nexora.local/nexora/services/api/internal/db"
)

func run() error {
	if len(os.Args) != 2 {
		return fmt.Errorf("usage: nexora {migrate|bootstrap|serve}")
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	switch os.Args[1] {
	case "migrate":
		if err = db.Migrate(ctx, pool); err != nil {
			return err
		}
		log.Print("database migrations applied")
	case "bootstrap":
		err = db.Bootstrap(ctx, pool, os.Getenv("NEXORA_BOOTSTRAP_ORG_SLUG"), os.Getenv("NEXORA_BOOTSTRAP_ORG_NAME"), os.Getenv("NEXORA_BOOTSTRAP_EMAIL"), os.Getenv("NEXORA_BOOTSTRAP_PASSWORD"))
		if err != nil {
			return fmt.Errorf("bootstrap failed: %w", err)
		}
		log.Print("administrator created; remove bootstrap secrets from environment")
	case "serve":
		if err = db.Ready(ctx, pool); err != nil {
			return fmt.Errorf("database not migrated")
		}
		app, err := api.New(pool, cfg)
		if err != nil {
			return err
		}
		signals, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
		defer stop()
		serveErr := make(chan error, 1)
		go func() { serveErr <- app.Listen(cfg.ListenAddr) }()
		log.Printf("development API listening on %s", cfg.ListenAddr)
		select {
		case <-signals.Done():
			shutdown, done := context.WithTimeout(context.Background(), 10*time.Second)
			defer done()
			return app.ShutdownWithContext(shutdown)
		case err := <-serveErr:
			return err
		}
	default:
		return fmt.Errorf("usage: nexora {migrate|bootstrap|serve}")
	}
	return nil
}
func main() {
	if err := run(); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}
