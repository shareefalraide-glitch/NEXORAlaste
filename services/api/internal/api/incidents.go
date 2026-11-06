package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"nexora.local/nexora/services/api/internal/db"
	"nexora.local/nexora/services/api/internal/domain"
)

type incidentRequest struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Severity    string `json:"severity"`
	AssetID     string `json:"asset_id,omitempty"`
}

func scanIncident(row pgx.Row) (fiber.Map, error) {
	var id, title, desc, severity, status, origin string
	var asset, assignee, root *string
	var created, updated time.Time
	err := row.Scan(&id, &title, &desc, &severity, &status, &origin, &asset, &assignee, &root, &created, &updated)
	if err != nil {
		return nil, err
	}
	return fiber.Map{"id": id, "title": title, "description": desc, "severity": severity, "status": status, "origin": origin, "asset_id": asset, "assignee_id": assignee, "root_cause": root, "created_at": created, "updated_at": updated}, nil
}

const incidentColumns = `id::text,title,description,severity,status,origin,asset_id::text,assignee_id::text,root_cause,created_at,updated_at`

func (s *Server) incidentsCreate(c *fiber.Ctx) error {
	var in incidentRequest
	if parseJSON(c, &in) != nil {
		return bad(c)
	}
	in.Title = strings.TrimSpace(in.Title)
	if len(in.Title) < 1 || len(in.Title) > 200 || len(in.Description) > 4000 || !inSet(in.Severity, "low", "medium", "high", "critical") || (in.AssetID != "" && !validID(in.AssetID)) {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	out, err := scanIncident(tx.QueryRow(c.UserContext(), `INSERT INTO incidents(organization_id,title,description,severity,asset_id) VALUES($1,$2,$3,$4,$5) RETURNING `+incidentColumns, p.OrganizationID, in.Title, in.Description, in.Severity, optional(in.AssetID)))
	if foreignKeyError(err) {
		return bad(c)
	}
	if err != nil {
		return internal(c)
	}
	id := out["id"].(string)
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "incident.created", "incident", id, metadata(c, out)); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.Status(201).JSON(out)
}
func (s *Server) incidentsList(c *fiber.Ctx) error {
	limit, offset, err := page(c)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	status := c.Query("status")
	if status != "" && !inSet(status, "new", "assigned", "investigating", "contained", "resolved", "closed") {
		return bad(c)
	}
	rows, err := s.pool.Query(c.UserContext(), `SELECT `+incidentColumns+` FROM incidents WHERE organization_id=$1 AND ($2='' OR status=$2) ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`, p.OrganizationID, status, limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		m, err := scanIncident(rows)
		if err != nil {
			return internal(c)
		}
		items = append(items, m)
	}
	if rows.Err() != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": items, "limit": limit, "offset": offset})
}
func (s *Server) incidentsGet(c *fiber.Ctx) error {
	if !validID(c.Params("id")) {
		return bad(c)
	}
	p := principal(c)
	out, err := scanIncident(s.pool.QueryRow(c.UserContext(), `SELECT `+incidentColumns+` FROM incidents WHERE organization_id=$1 AND id=$2`, p.OrganizationID, c.Params("id")))
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	return c.JSON(out)
}
func (s *Server) incidentTransition(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	var in domain.Transition
	if parseJSON(c, &in) != nil || (in.AssigneeID != "" && !validID(in.AssigneeID)) || (in.AssigneeID != "" && in.ToStatus != "assigned") || (in.RootCause != "" && in.ToStatus != "closed") {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var previous string
	err = tx.QueryRow(c.UserContext(), `SELECT status FROM incidents WHERE organization_id=$1 AND id=$2 FOR UPDATE`, p.OrganizationID, id).Scan(&previous)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	if code, message := domain.CanTransition(previous, in); code != "" {
		return fail(c, 409, code, message)
	}
	out, err := scanIncident(tx.QueryRow(c.UserContext(), `UPDATE incidents SET status=$3,
        assignee_id=COALESCE($4::uuid,assignee_id), root_cause=CASE WHEN $5='' THEN root_cause ELSE $5 END,updated_at=now()
        WHERE organization_id=$1 AND id=$2 RETURNING `+incidentColumns, p.OrganizationID, id, in.ToStatus, optional(in.AssigneeID), in.RootCause))
	if foreignKeyError(err) {
		return bad(c)
	}
	if err != nil {
		return internal(c)
	}
	payload := fiber.Map{"before": fiber.Map{"status": previous}, "after": fiber.Map{"status": in.ToStatus, "assignee_id": optional(in.AssigneeID), "root_cause": optional(in.RootCause)}, "reason": optional(in.Reason), "remote_ip": c.IP(), "request_id": c.Locals("request_id")}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "incident.transition", "incident", id, payload); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(out)
}

type noteRequest struct {
	Body string `json:"body"`
}

func (s *Server) notesCreate(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	var in noteRequest
	if parseJSON(c, &in) != nil {
		return bad(c)
	}
	in.Body = strings.TrimSpace(in.Body)
	if len(in.Body) < 1 || len(in.Body) > 4000 {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var note string
	var created time.Time
	err = tx.QueryRow(c.UserContext(), `INSERT INTO incident_notes(organization_id,incident_id,author_id,body)
        SELECT $1,id,$3,$4 FROM incidents WHERE organization_id=$1 AND id=$2 RETURNING id::text,created_at`, p.OrganizationID, id, p.ID, in.Body).Scan(&note, &created)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	out := fiber.Map{"id": note, "incident_id": id, "author_id": p.ID, "body": in.Body, "created_at": created}
	// The note text is deliberately not copied into the audit chain.
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "incident.note_created", "incident_note", note, metadata(c, fiber.Map{"incident_id": id})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.Status(201).JSON(out)
}
func (s *Server) notesList(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	limit, offset, err := page(c)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	var exists bool
	if err = s.pool.QueryRow(c.UserContext(), `SELECT EXISTS(SELECT 1 FROM incidents WHERE organization_id=$1 AND id=$2)`, p.OrganizationID, id).Scan(&exists); err != nil {
		return internal(c)
	}
	if !exists {
		return absent(c)
	}
	rows, err := s.pool.Query(c.UserContext(), `SELECT id::text,author_id::text,body,created_at FROM incident_notes WHERE organization_id=$1 AND incident_id=$2 ORDER BY created_at ASC,id ASC LIMIT $3 OFFSET $4`, p.OrganizationID, id, limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		var note, author, body string
		var created time.Time
		if rows.Scan(&note, &author, &body, &created) != nil {
			return internal(c)
		}
		items = append(items, fiber.Map{"id": note, "incident_id": id, "author_id": author, "body": body, "created_at": created})
	}
	if rows.Err() != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": items, "limit": limit, "offset": offset})
}
func (s *Server) auditList(c *fiber.Ctx) error {
	limit, _, err := page(c)
	if err != nil {
		return bad(c)
	}
	if c.Query("offset") != "" && c.Query("offset") != "0" {
		return bad(c)
	}
	p := principal(c)
	entries, err := db.ReadAudit(c.UserContext(), s.pool, p.OrganizationID, limit)
	if err != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": entries, "limit": limit})
}
func (s *Server) auditVerify(c *fiber.Ctx) error {
	p := principal(c)
	result, err := db.VerifyAudit(c.UserContext(), s.pool, p.OrganizationID)
	if err != nil {
		return internal(c)
	}
	return c.JSON(result)
}
