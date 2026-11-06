package config

import "testing"

func TestConfigurationRequiresExplicitDevelopmentAndSecrets(t *testing.T) {
	t.Setenv("NEXORA_ENV", "production")
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost/db")
	t.Setenv("NEXORA_JWT_SECRET", "test-key-never-use-in-production-123456789")
	if _, err := Load(); err == nil {
		t.Fatal("production mode must fail closed")
	}
	t.Setenv("NEXORA_ENV", "development")
	t.Setenv("NEXORA_JWT_SECRET", "short")
	if _, err := Load(); err == nil {
		t.Fatal("short signing secret accepted")
	}
	t.Setenv("NEXORA_JWT_SECRET", "test-key-never-use-in-production-123456789")
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("missing database URL accepted")
	}
	t.Setenv("DATABASE_URL", "postgres://user:pass@localhost/db")
	if cfg, err := Load(); err != nil || cfg.ListenAddr != "127.0.0.1:8080" {
		t.Fatalf("development config failed: %v", err)
	}
}
