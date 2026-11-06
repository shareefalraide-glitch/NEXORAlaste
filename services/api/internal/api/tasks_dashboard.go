package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"nexora.local/nexora/services/api/internal/db"
)

type taskInput struct {
	Title      string `json:"title"`
	AssigneeID string `json:"assignee_id,omitempty"`
	DueAt      string `json:"due_at,omitempty"`
}
type taskUpdate struct {
	Title      *string `json:"title"`
	Status     *string `json:"status"`
	AssigneeID *string `json:"assignee_id"`
	DueAt      *string `json:"due_at"`
}

const taskColumns = `id::text,incident_id::text,title,status,assignee_id::text,due_at,created_at,updated_at`

func scanTask(row pgx.Row) (fiber.Map, error) {
	var id, incident, title, status string
	var assignee *string
	var due *time.Time
	var created, updated time.Time
	if err := row.Scan(&id, &incident, &title, &status, &assignee, &due, &created, &updated); err != nil {
		return nil, err
	}
	return fiber.Map{"id": id, "incident_id": incident, "title": title, "status": status, "assignee_id": assignee, "due_at": due, "created_at": created, "updated_at": updated}, nil
}
func parseOptionalTime(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	v, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		return nil, err
	}
	u := v.UTC()
	return &u, nil
}
func (s *Server) tasksCreate(c *fiber.Ctx) error {
	id := c.Params("id")
	if !validID(id) {
		return bad(c)
	}
	var in taskInput
	if parseJSON(c, &in) != nil {
		return bad(c)
	}
	in.Title = strings.TrimSpace(in.Title)
	due, err := parseOptionalTime(in.DueAt)
	if err != nil || len(in.Title) < 1 || len(in.Title) > 300 || (in.AssigneeID != "" && !validID(in.AssigneeID)) {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	out, err := scanTask(tx.QueryRow(c.UserContext(), `INSERT INTO incident_tasks(organization_id,incident_id,title,assignee_id,due_at)
        SELECT $1,id,$3,$4,$5 FROM incidents WHERE organization_id=$1 AND id=$2 RETURNING `+taskColumns, p.OrganizationID, id, in.Title, optional(in.AssigneeID), due))
	if isNoRows(err) {
		return absent(c)
	}
	if foreignKeyError(err) {
		return bad(c)
	}
	if err != nil {
		return internal(c)
	}
	taskID := out["id"].(string)
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "incident.task_created", "task", taskID, metadata(c, fiber.Map{"incident_id": id, "status": "todo", "assignee_id": optional(in.AssigneeID)})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.Status(201).JSON(out)
}
func (s *Server) tasksList(c *fiber.Ctx) error {
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
	rows, err := s.pool.Query(c.UserContext(), `SELECT `+taskColumns+` FROM incident_tasks WHERE organization_id=$1 AND incident_id=$2 ORDER BY created_at ASC,id ASC LIMIT $3 OFFSET $4`, p.OrganizationID, id, limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		m, e := scanTask(rows)
		if e != nil {
			return internal(c)
		}
		items = append(items, m)
	}
	if rows.Err() != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"items": items, "limit": limit, "offset": offset})
}
func (s *Server) tasksUpdate(c *fiber.Ctx) error {
	incident, id := c.Params("id"), c.Params("task_id")
	if !validID(incident) || !validID(id) {
		return bad(c)
	}
	var in taskUpdate
	if parseJSON(c, &in) != nil || (in.Title == nil && in.Status == nil && in.AssigneeID == nil && in.DueAt == nil) {
		return bad(c)
	}
	p := principal(c)
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var title, status string
	var assignee *string
	var due *time.Time
	err = tx.QueryRow(c.UserContext(), `SELECT title,status,assignee_id::text,due_at FROM incident_tasks WHERE organization_id=$1 AND incident_id=$2 AND id=$3 FOR UPDATE`, p.OrganizationID, incident, id).Scan(&title, &status, &assignee, &due)
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	before := fiber.Map{"status": status, "assignee_id": assignee, "due_at": due}
	if in.Title != nil {
		title = strings.TrimSpace(*in.Title)
	}
	if in.Status != nil {
		status = *in.Status
	}
	if in.AssigneeID != nil {
		if *in.AssigneeID == "" {
			assignee = nil
		} else {
			assignee = in.AssigneeID
		}
	}
	if in.DueAt != nil {
		due, err = parseOptionalTime(*in.DueAt)
		if err != nil {
			return bad(c)
		}
	}
	if len(title) < 1 || len(title) > 300 || !inSet(status, "todo", "in_progress", "done") || (assignee != nil && !validID(*assignee)) {
		return bad(c)
	}
	out, err := scanTask(tx.QueryRow(c.UserContext(), `UPDATE incident_tasks SET title=$4,status=$5,assignee_id=$6,due_at=$7,updated_at=now() WHERE organization_id=$1 AND incident_id=$2 AND id=$3 RETURNING `+taskColumns, p.OrganizationID, incident, id, title, status, assignee, due))
	if foreignKeyError(err) {
		return bad(c)
	}
	if err != nil {
		return internal(c)
	}
	if err = db.AppendAudit(c.UserContext(), tx, p.OrganizationID, p.ID, "incident.task_updated", "task", id, fiber.Map{"incident_id": incident, "before": before, "after": fiber.Map{"status": status, "assignee_id": assignee, "due_at": due}, "title_changed": in.Title != nil, "remote_ip": c.IP(), "request_id": c.Locals("request_id")}); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(out)
}

func (s *Server) dashboardSummary(c *fiber.Ctx) error {
	now := time.Now().UTC()
	from, to := now.Add(-24*time.Hour), now
	var err error
	if raw := c.Query("from"); raw != "" {
		from, err = time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return bad(c)
		}
	}
	if raw := c.Query("to"); raw != "" {
		to, err = time.Parse(time.RFC3339Nano, raw)
		if err != nil {
			return bad(c)
		}
	}
	from, to = from.UTC(), to.UTC()
	if !from.Before(to) || to.Sub(from) > 90*24*time.Hour {
		return bad(c)
	}
	p := principal(c)
	var events, created, open, assets, sources int64
	err = s.pool.QueryRow(c.UserContext(), `SELECT
       (SELECT count(*) FROM events WHERE organization_id=$1 AND observed_at >= $2 AND observed_at < $3),
       (SELECT count(*) FROM incidents WHERE organization_id=$1 AND created_at >= $2 AND created_at < $3),
       (SELECT count(*) FROM incidents WHERE organization_id=$1 AND status <> 'closed'),
       (SELECT count(*) FROM assets WHERE organization_id=$1),
       (SELECT count(*) FROM sources WHERE organization_id=$1)`, p.OrganizationID, from, to).Scan(&events, &created, &open, &assets, &sources)
	if err != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"window": fiber.Map{"from": from, "to": to}, "counts": fiber.Map{"events": events, "incidents_created": created, "open_incidents_now": open, "assets_now": assets, "sources_configured_now": sources, "alerts": nil}, "data_status": fiber.Map{"events": "stored_subset_only", "incidents": "manual_only", "alerts": "unavailable", "detection": "not_implemented"}, "calculated_at": now})
}
