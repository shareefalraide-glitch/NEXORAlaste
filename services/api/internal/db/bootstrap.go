package db

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"nexora.local/nexora/services/api/internal/auth"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}$`)

func Bootstrap(ctx context.Context, pool *pgxpool.Pool, slug, name, email, password string) error {
	slug = strings.TrimSpace(slug)
	name = strings.TrimSpace(name)
	email = strings.ToLower(strings.TrimSpace(email))
	if !slugPattern.MatchString(slug) || len(name) < 1 || len(name) > 160 || len(email) < 3 || len(email) > 254 || !strings.Contains(email, "@") {
		return fmt.Errorf("invalid organization or email")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `INSERT INTO organizations(slug,name) VALUES ($1,$2) ON CONFLICT(slug) DO NOTHING`, slug, name); err != nil {
		return err
	}
	var org, user string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM organizations WHERE slug=$1`, slug).Scan(&org); err != nil {
		return err
	}
	if err = tx.QueryRow(ctx, `INSERT INTO users(organization_id,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id::text`, org, email, hash).Scan(&user); err != nil {
		return fmt.Errorf("admin was not created (the email may already exist)")
	}
	if err = AppendAudit(ctx, tx, org, "bootstrap", "user.created", "user", user, map[string]any{"role": "admin", "email": email, "source": "bootstrap"}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
