package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"nexora.local/nexora/services/api/internal/auth"
	"nexora.local/nexora/services/api/internal/db"
)

func optional(s string) any {
	if s == "" {
		return nil
	}
	return s
}
func inSet(s string, values ...string) bool {
	for _, v := range values {
		if s == v {
			return true
		}
	}
	return false
}

type assetRequest struct {
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Criticality string `json:"criticality"`
	PrimaryIP   string `json:"primary_ip,omitempty"`
}

func (s *Server) assetsCreate(c *fiber.Ctx) error {
	var in assetRequest
	if parseJSON(c, &in) != nil {
		return bad(c)
	}
	in.Name = strings.TrimSpace(in.Name)
	if len(in.Name) < 1 || len(in.Name) > 160 || !inSet(in.Kind, "server", "workstation", "network_device", "other") || !inSet(in.Criticality, "low", "medium", "critical") || !validIP(in.PrimaryIP) {
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
	err = tx.QueryRow(c.UserContext(), `INSERT INTO assets(organization_id,name,kind,criticality,primary_ip) VALUES($1,$2,$3,$4,$5) RETURNING id::text,created_at`, p.OrganizationID, in.Name, in.Kind, in.Criticality, optional(in.PrimaryIP)).Scan(&id, &created)
	if err != nil {
		return internal(c)
	}
	out := fiber.Map{"id": id, "name": in.Name, "kind": in.Kind, "criticality": in.Criticality, "primary_ip": optional(in.PrimaryIP), "created_at": created}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "asset.created", "asset", id, metadata(c, out)); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.Status(201).JSON(out)
}
func (s *Server) assetsList(c *fiber.Ctx) error {
	limit, offset, err := page(c)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	rows, err := s.pool.Query(c.UserContext(), `SELECT id::text,name,kind,criticality,host(primary_ip),created_at FROM assets WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, p.OrganizationID, limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		var id, name, kind, criticality string
		var ip *string
		var created time.Time
		if rows.Scan(&id, &name, &kind, &criticality, &ip, &created) != nil {
			return internal(c)
		}
		items = append(items, fiber.Map{"id": id, "name": name, "kind": kind, "criticality": criticality, "primary_ip": ip, "created_at": created})
	}
	if rows.Err() != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": items, "limit": limit, "offset": offset})
}
func (s *Server) assetsGet(c *fiber.Ctx) error {
	if !validID(c.Params("id")) {
		return bad(c)
	}
	p := principal(c)
	var id, name, kind, criticality string
	var ip *string
	var created time.Time
	err := s.pool.QueryRow(c.UserContext(), `SELECT id::text,name,kind,criticality,host(primary_ip),created_at FROM assets WHERE organization_id=$1 AND id=$2`, p.OrganizationID, c.Params("id")).Scan(&id, &name, &kind, &criticality, &ip, &created)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"id": id, "name": name, "kind": kind, "criticality": criticality, "primary_ip": ip, "created_at": created})
}

type sourceRequest struct {
	Name             string `json:"name"`
	Kind             string `json:"kind"`
	CollectionMethod string `json:"collection_method"`
}

func (s *Server) sourcesCreate(c *fiber.Ctx) error {
	var in sourceRequest
	if parseJSON(c, &in) != nil {
		return bad(c)
	}
	in.Name = strings.TrimSpace(in.Name)
	in.CollectionMethod = strings.TrimSpace(in.CollectionMethod)
	if len(in.Name) < 1 || len(in.Name) > 160 || !inSet(in.Kind, "sensor", "network_device", "host", "other") || len(in.CollectionMethod) < 1 || len(in.CollectionMethod) > 80 {
		return bad(c)
	}
	token, hash, err := auth.NewSecret("src_")
	if err != nil {
		return internal(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var id string
	var created time.Time
	err = tx.QueryRow(c.UserContext(), `INSERT INTO sources(organization_id,name,kind,collection_method,token_hash) VALUES($1,$2,$3,$4,$5) RETURNING id::text,created_at`, p.OrganizationID, in.Name, in.Kind, in.CollectionMethod, hash).Scan(&id, &created)
	if err != nil {
		return internal(c)
	}
	out := fiber.Map{"id": id, "name": in.Name, "kind": in.Kind, "collection_method": in.CollectionMethod, "active": true, "last_received_at": nil, "created_at": created}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "source.created", "source", id, metadata(c, out)); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.Status(201).JSON(fiber.Map{"source": out, "ingest_token": token, "token_displayed_once": true})
}
func (s *Server) sourcesList(c *fiber.Ctx) error {
	limit, offset, err := page(c)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	rows, err := s.pool.Query(c.UserContext(), `SELECT id::text,name,kind,collection_method,active,last_received_at,created_at FROM sources WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, p.OrganizationID, limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		var id, name, kind, method string
		var active bool
		var last *time.Time
		var created time.Time
		if rows.Scan(&id, &name, &kind, &method, &active, &last, &created) != nil {
			return internal(c)
		}
		items = append(items, fiber.Map{"id": id, "name": name, "kind": kind, "collection_method": method, "active": active, "last_received_at": last, "created_at": created})
	}
	if rows.Err() != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": items, "limit": limit, "offset": offset})
}
