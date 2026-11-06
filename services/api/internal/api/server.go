package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"nexora.local/nexora/services/api/internal/auth"
	"nexora.local/nexora/services/api/internal/config"
	"nexora.local/nexora/services/api/internal/db"
)

type Server struct {
	pool      *pgxpool.Pool
	key       []byte
	dummyHash string
}
type Principal struct{ ID, OrganizationID, Email, Role, SessionID string }

func New(pool *pgxpool.Pool, cfg config.Config) (*fiber.App, error) {
	dummy, err := auth.HashPassword("constant-dummy-password-not-an-account")
	if err != nil {
		return nil, err
	}
	s := &Server{pool: pool, key: cfg.JWTSecret, dummyHash: dummy}
	app := fiber.New(fiber.Config{
		DisableStartupMessage: true, BodyLimit: 1024 * 1024, ReadTimeout: 15 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			var fe *fiber.Error
			if errors.As(err, &fe) && fe.Code < 500 {
				return fail(c, fe.Code, "invalid_request", "Request could not be processed.")
			}
			return fail(c, 500, "internal_error", "The request could not be completed.")
		},
	})
	app.Use(recover.New())
	app.Use(func(c *fiber.Ctx) error {
		c.Locals("request_id", uuid.NewString())
		c.Set("X-Request-ID", c.Locals("request_id").(string))
		c.Set("Cache-Control", "no-store")
		c.Set("X-Content-Type-Options", "nosniff")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		c.SetUserContext(ctx)
		return c.Next()
	})
	app.Get("/health/live", func(c *fiber.Ctx) error { return c.JSON(fiber.Map{"status": "live"}) })
	app.Get("/health/ready", func(c *fiber.Ctx) error {
		if db.Ready(c.UserContext(), pool) != nil {
			return fail(c, 503, "not_ready", "Database or migrations are unavailable.")
		}
		return c.JSON(fiber.Map{"status": "ready"})
	})
	loginLimit := limiter.New(limiter.Config{Max: 10, Expiration: time.Minute, KeyGenerator: func(c *fiber.Ctx) string { return c.IP() }, LimitReached: func(c *fiber.Ctx) error { return fail(c, 429, "rate_limited", "Try again later.") }})
	v := app.Group("/api/v1")
	v.Post("/auth/login", loginLimit, s.login)
	v.Post("/auth/refresh", loginLimit, s.refresh)
	v.Post("/auth/logout", s.require("read"), s.logout)
	v.Get("/auth/me", s.require("read"), s.me)
	v.Get("/users", s.require("admin"), s.usersList)
	v.Post("/users", s.require("admin"), s.usersCreate)
	v.Get("/assets", s.require("read"), s.assetsList)
	v.Post("/assets", s.require("admin"), s.assetsCreate)
	v.Get("/assets/:id", s.require("read"), s.assetsGet)
	v.Patch("/assets/:id", s.require("admin"), s.assetsUpdate)
	v.Get("/sources", s.require("read"), s.sourcesList)
	v.Post("/sources", s.require("admin"), s.sourcesCreate)
	v.Get("/sources/:id", s.require("read"), s.sourcesGet)
	v.Post("/sources/:id/token-rotations", s.require("admin"), s.sourcesRotateToken)
	v.Post("/sources/:id/token-revocations", s.require("admin"), s.sourcesRevokeToken)
	v.Get("/events", s.require("read"), s.eventsList)
	v.Get("/events/:id", s.require("read"), s.eventsGet)
	v.Get("/incidents", s.require("read"), s.incidentsList)
	v.Post("/incidents", s.require("incident:write"), s.incidentsCreate)
	v.Get("/incidents/:id", s.require("read"), s.incidentsGet)
	v.Post("/incidents/:id/transitions", s.require("incident:write"), s.incidentTransition)
	v.Get("/incidents/:id/notes", s.require("read"), s.notesList)
	v.Post("/incidents/:id/notes", s.require("incident:write"), s.notesCreate)
	v.Get("/incidents/:id/tasks", s.require("read"), s.tasksList)
	v.Post("/incidents/:id/tasks", s.require("incident:write"), s.tasksCreate)
	v.Patch("/incidents/:id/tasks/:task_id", s.require("incident:write"), s.tasksUpdate)
	v.Get("/dashboard/summary", s.require("read"), s.dashboardSummary)
	v.Get("/audit", s.require("audit:read"), s.auditList)
	v.Get("/audit/verify", s.require("audit:read"), s.auditVerify)
	// This is a private L2 -> storage adapter endpoint, not a raw sensor API.
	app.Post("/internal/v1/event-batches", s.ingest)
	return app, nil
}

func fail(c *fiber.Ctx, status int, code, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": fiber.Map{"code": code, "message": message, "request_id": c.Locals("request_id")}})
}
func bad(c *fiber.Ctx) error {
	return fail(c, 400, "invalid_input", "One or more request fields are invalid.")
}
func internal(c *fiber.Ctx) error {
	return fail(c, 500, "internal_error", "The request could not be completed.")
}
func absent(c *fiber.Ctx) error { return fail(c, 404, "not_found", "Resource not found.") }
func validID(s string) bool     { _, err := uuid.Parse(s); return err == nil }
func isNoRows(err error) bool   { return errors.Is(err, pgx.ErrNoRows) }
func parseJSON(c *fiber.Ctx, dst any) error {
	mediaType, _, err := mime.ParseMediaType(c.Get("Content-Type"))
	if err != nil || mediaType != "application/json" {
		return errors.New("content type")
	}
	dec := json.NewDecoder(bytes.NewReader(c.Body()))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("multiple JSON values")
	}
	return nil
}
func page(c *fiber.Ctx) (int, int, error) {
	limit, offset := 50, 0
	var err error
	if s := c.Query("limit"); s != "" {
		limit, err = strconv.Atoi(s)
		if err != nil {
			return 0, 0, err
		}
	}
	if s := c.Query("offset"); s != "" {
		offset, err = strconv.Atoi(s)
		if err != nil {
			return 0, 0, err
		}
	}
	if limit < 1 || limit > 100 || offset < 0 || offset > 10000 {
		return 0, 0, errors.New("pagination out of range")
	}
	return limit, offset, nil
}
func validIP(p string) bool            { return p == "" || net.ParseIP(p) != nil }
func principal(c *fiber.Ctx) Principal { return c.Locals("principal").(Principal) }
func actor(c *fiber.Ctx) string        { return principal(c).ID }
func metadata(c *fiber.Ctx, after any) any {
	return fiber.Map{"after": after, "remote_ip": c.IP(), "request_id": c.Locals("request_id")}
}

func (s *Server) require(permission string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		claims, err := auth.Verify(s.key, auth.Bearer(c.Get("Authorization")))
		if err != nil {
			return fail(c, 401, "unauthorized", "Authentication required.")
		}
		var p Principal
		err = s.pool.QueryRow(c.UserContext(), `SELECT u.id::text,u.organization_id::text,u.email,u.role,s.id::text
            FROM sessions s JOIN users u ON u.organization_id=s.organization_id AND u.id=s.user_id
            WHERE s.id=$1 AND u.id=$2 AND s.organization_id=$3 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.active`, claims.ID, claims.Subject, claims.OrganizationID).
			Scan(&p.ID, &p.OrganizationID, &p.Email, &p.Role, &p.SessionID)
		if isNoRows(err) {
			return fail(c, 401, "unauthorized", "Authentication required.")
		}
		if err != nil {
			return fail(c, 503, "unavailable", "Authentication service is unavailable.")
		}
		if !auth.Allowed(p.Role, permission) {
			return fail(c, 403, "forbidden", "The role does not permit this action.")
		}
		c.Locals("principal", p)
		return c.Next()
	}
}
