package api

import (
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"nexora.local/nexora/services/api/internal/auth"
	"nexora.local/nexora/services/api/internal/db"
)

type loginRequest struct {
	Organization string `json:"organization"`
	Email        string `json:"email"`
	Password     string `json:"password"`
}
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

func tokens(access, refresh string) tokenResponse {
	return tokenResponse{access, refresh, "Bearer", int(auth.AccessLifetime.Seconds())}
}
func validEmail(s string) bool {
	a, e := mail.ParseAddress(s)
	return e == nil && strings.EqualFold(a.Address, s) && len(s) <= 254
}
func uniqueError(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23505"
}
func foreignKeyError(err error) bool {
	var pg *pgconn.PgError
	return errors.As(err, &pg) && pg.Code == "23503"
}

func (s *Server) login(c *fiber.Ctx) error {
	var in loginRequest
	if parseJSON(c, &in) != nil || len(in.Organization) > 63 || len(in.Email) > 254 || len(in.Password) > 72 {
		return bad(c)
	}
	var org, user, email, role, hash string
	var active bool
	err := s.pool.QueryRow(c.UserContext(), `SELECT o.id::text,u.id::text,u.email,u.role,u.password_hash,u.active
        FROM users u JOIN organizations o ON o.id=u.organization_id WHERE o.slug=$1 AND lower(u.email)=lower($2)`, strings.TrimSpace(in.Organization), strings.TrimSpace(in.Email)).Scan(&org, &user, &email, &role, &hash, &active)
	if isNoRows(err) {
		_ = auth.ComparePassword(s.dummyHash, in.Password)
		return fail(c, 401, "invalid_credentials", "Invalid credentials.")
	}
	if err != nil {
		return fail(c, 503, "unavailable", "Authentication service is unavailable.")
	}
	if !auth.ComparePassword(hash, in.Password) || !active {
		return fail(c, 401, "invalid_credentials", "Invalid credentials.")
	}
	refresh, refreshHash, err := auth.NewSecret("rfr_")
	if err != nil {
		return internal(c)
	}
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var session string
	err = tx.QueryRow(c.UserContext(), `INSERT INTO sessions(organization_id,user_id,refresh_hash,expires_at) VALUES($1,$2,$3,$4) RETURNING id::text`, org, user, refreshHash, time.Now().UTC().Add(auth.RefreshLifetime)).Scan(&session)
	if err != nil {
		return internal(c)
	}
	access, err := auth.Sign(s.key, org, user, session, time.Now().UTC())
	if err != nil {
		return internal(c)
	}
	if err = db.AppendAudit(c.UserContext(), tx, org, user, "session.login", "session", session, metadata(c, fiber.Map{"role": role})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(tokens(access, refresh))
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

func (s *Server) refresh(c *fiber.Ctx) error {
	var in refreshRequest
	if parseJSON(c, &in) != nil || !strings.HasPrefix(in.RefreshToken, "rfr_") || len(in.RefreshToken) > 100 {
		return bad(c)
	}
	newToken, newHash, err := auth.NewSecret("rfr_")
	if err != nil {
		return internal(c)
	}
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var org, user, session string
	err = tx.QueryRow(c.UserContext(), `SELECT s.organization_id::text,s.user_id::text,s.id::text
        FROM sessions s JOIN users u ON u.organization_id=s.organization_id AND u.id=s.user_id
        WHERE s.refresh_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active FOR UPDATE OF s`, auth.HashSecret(in.RefreshToken)).Scan(&org, &user, &session)
	if isNoRows(err) {
		return fail(c, 401, "invalid_refresh_token", "Invalid or expired refresh token.")
	}
	if err != nil {
		return internal(c)
	}
	if _, err = tx.Exec(c.UserContext(), `UPDATE sessions SET refresh_hash=$1 WHERE id=$2`, newHash, session); err != nil {
		return internal(c)
	}
	access, err := auth.Sign(s.key, org, user, session, time.Now().UTC())
	if err != nil {
		return internal(c)
	}
	if err = db.AppendAudit(c.UserContext(), tx, org, user, "session.refresh", "session", session, metadata(c, nil)); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(tokens(access, newToken))
}
func (s *Server) logout(c *fiber.Ctx) error {
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	if _, err = tx.Exec(c.UserContext(), `UPDATE sessions SET revoked_at=now() WHERE id=$1 AND organization_id=$2 AND revoked_at IS NULL`, p.SessionID, p.OrganizationID); err != nil {
		return internal(c)
	}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "session.logout", "session", p.SessionID, metadata(c, nil)); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.SendStatus(204)
}
func (s *Server) me(c *fiber.Ctx) error {
	p := principal(c)
	return c.JSON(fiber.Map{"id": p.ID, "organization_id": p.OrganizationID, "email": p.Email, "role": p.Role})
}

type userRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func validRole(r string) bool {
	switch r {
	case "admin", "analyst", "responder", "auditor", "viewer":
		return true
	}
	return false
}
func (s *Server) usersCreate(c *fiber.Ctx) error {
	var in userRequest
	if parseJSON(c, &in) != nil {
		return bad(c)
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	if !validEmail(in.Email) || !validRole(in.Role) {
		return bad(c)
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var id string
	var created time.Time
	err = tx.QueryRow(c.UserContext(), `INSERT INTO users(organization_id,email,password_hash,role) VALUES($1,$2,$3,$4) RETURNING id::text,created_at`, p.OrganizationID, in.Email, hash, in.Role).Scan(&id, &created)
	if uniqueError(err) {
		return fail(c, 409, "already_exists", "A user with that email already exists.")
	}
	if err != nil {
		return internal(c)
	}
	out := fiber.Map{"id": id, "email": in.Email, "role": in.Role, "active": true, "created_at": created}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "user.created", "user", id, metadata(c, fiber.Map{"email": in.Email, "role": in.Role})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.Status(201).JSON(out)
}
func (s *Server) usersList(c *fiber.Ctx) error {
	limit, offset, err := page(c)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	rows, err := s.pool.Query(c.UserContext(), `SELECT id::text,email,role,active,created_at FROM users WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, p.OrganizationID, limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		var id, email, role string
		var active bool
		var created time.Time
		if rows.Scan(&id, &email, &role, &active, &created) != nil {
			return internal(c)
		}
		items = append(items, fiber.Map{"id": id, "email": email, "role": role, "active": active, "created_at": created})
	}
	if rows.Err() != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": items, "limit": limit, "offset": offset})
}
