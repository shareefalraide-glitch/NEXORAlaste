package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"nexora.local/nexora/services/api/internal/auth"
	"nexora.local/nexora/services/api/internal/db"
)

type assetUpdate struct {
	Name        *string `json:"name"`
	Kind        *string `json:"kind"`
	Criticality *string `json:"criticality"`
	PrimaryIP   *string `json:"primary_ip"`
}

func (s *Server) assetsUpdate(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	var in assetUpdate
	if parseJSON(c, &in) != nil || (in.Name == nil && in.Kind == nil && in.Criticality == nil && in.PrimaryIP == nil) {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var name, kind, criticality string
	var ip *string
	var created time.Time
	err = tx.QueryRow(c.UserContext(), `SELECT name,kind,criticality,host(primary_ip),created_at FROM assets WHERE organization_id=$1 AND id=$2 FOR UPDATE`, p.OrganizationID, id).Scan(&name, &kind, &criticality, &ip, &created)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	before := fiber.Map{"name": name, "kind": kind, "criticality": criticality, "primary_ip": ip}
	if in.Name != nil {
		name = strings.TrimSpace(*in.Name)
	}
	if in.Kind != nil {
		kind = *in.Kind
	}
	if in.Criticality != nil {
		criticality = *in.Criticality
	}
	if in.PrimaryIP != nil {
		if *in.PrimaryIP == "" {
			ip = nil
		} else {
			ip = in.PrimaryIP
		}
	}
	if len(name) < 1 || len(name) > 160 || !inSet(kind, "server", "workstation", "network_device", "other") || !inSet(criticality, "low", "medium", "critical") || (ip != nil && !validIP(*ip)) {
		return bad(c)
	}
	if _, err = tx.Exec(c.UserContext(), `UPDATE assets SET name=$3,kind=$4,criticality=$5,primary_ip=$6 WHERE organization_id=$1 AND id=$2`, p.OrganizationID, id, name, kind, criticality, ip); err != nil {
		return internal(c)
	}
	out := fiber.Map{"id": id, "name": name, "kind": kind, "criticality": criticality, "primary_ip": ip, "created_at": created}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "asset.updated", "asset", id, fiber.Map{"before": before, "after": out, "remote_ip": c.IP(), "request_id": c.Locals("request_id")}); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(out)
}

func (s *Server) sourcesGet(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	p := principal(c)
	var name, kind, method string
	var active bool
	var last *time.Time
	var created time.Time
	err := s.pool.QueryRow(c.UserContext(), `SELECT name,kind,collection_method,active,last_received_at,created_at FROM sources WHERE organization_id=$1 AND id=$2`, p.OrganizationID, id).Scan(&name, &kind, &method, &active, &last, &created)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"id": id, "name": name, "kind": kind, "collection_method": method, "active": active, "last_received_at": last, "created_at": created})
}
func (s *Server) sourcesRotateToken(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	p := principal(c)
	token, hash, err := auth.NewSecret("src_")
	if err != nil {
		return internal(c)
	}
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var name, kind, method string
	var last *time.Time
	var created time.Time
	err = tx.QueryRow(c.UserContext(), `UPDATE sources SET token_hash=$3,active=true WHERE organization_id=$1 AND id=$2 RETURNING name,kind,collection_method,last_received_at,created_at`, p.OrganizationID, id, hash).Scan(&name, &kind, &method, &last, &created)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	out := fiber.Map{"id": id, "name": name, "kind": kind, "collection_method": method, "active": true, "last_received_at": last, "created_at": created}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "source.token_rotated", "source", id, metadata(c, fiber.Map{"active": true})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"source": out, "ingest_token": token, "token_displayed_once": true})
}
func (s *Server) sourcesRevokeToken(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var active bool
	err = tx.QueryRow(c.UserContext(), `SELECT active FROM sources WHERE organization_id=$1 AND id=$2 FOR UPDATE`, p.OrganizationID, id).Scan(&active)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	if !active {
		return c.SendStatus(204)
	}
	if _, err = tx.Exec(c.UserContext(), `UPDATE sources SET active=false WHERE organization_id=$1 AND id=$2`, p.OrganizationID, id); err != nil {
		return internal(c)
	}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "source.token_revoked", "source", id, metadata(c, fiber.Map{"active": false})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.SendStatus(204)
}
