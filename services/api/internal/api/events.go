package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
	"nexora.local/nexora/services/api/internal/auth"
	"nexora.local/nexora/services/api/internal/db"
)

type eventInput struct {
	SourceSequence    string `json:"source_sequence"`
	OriginalTimestamp string `json:"original_timestamp"`
	AssetID           string `json:"asset_id,omitempty"`
	Category          string `json:"category"`
	Action            string `json:"action"`
	SourceIP          string `json:"source_ip,omitempty"`
	DestinationIP     string `json:"destination_ip,omitempty"`
	Message           string `json:"message,omitempty"`
}
type batchRequest struct {
	Events []eventInput `json:"events"`
}

func (s *Server) ingest(c *fiber.Ctx) error {
	token := c.Get("X-Source-Token")
	if !strings.HasPrefix(token, "src_") || len(token) > 100 {
		return fail(c, 401, "unauthorized_source", "A valid source token is required.")
	}
	var in batchRequest
	if parseJSON(c, &in) != nil || len(in.Events) < 1 || len(in.Events) > 100 {
		return bad(c)
	}
	times := make([]time.Time, len(in.Events))
	for i, e := range in.Events {
		t, err := time.Parse(time.RFC3339Nano, e.OriginalTimestamp)
		if err != nil || len(e.OriginalTimestamp) > 64 || len(strings.TrimSpace(e.SourceSequence)) < 1 || len(e.SourceSequence) > 128 || len(strings.TrimSpace(e.Category)) < 1 || len(e.Category) > 100 || len(strings.TrimSpace(e.Action)) < 1 || len(e.Action) > 100 || len(e.Message) > 4096 || (e.AssetID != "" && !validID(e.AssetID)) || !validIP(e.SourceIP) || !validIP(e.DestinationIP) {
			return bad(c)
		}
		times[i] = t.UTC()
	}
	tx, err := s.pool.Begin(c.UserContext())
	if err != nil {
		return internal(c)
	}
	defer tx.Rollback(c.UserContext())
	var org, source string
	err = tx.QueryRow(c.UserContext(), `SELECT organization_id::text,id::text FROM sources WHERE token_hash=$1 AND active FOR UPDATE`, auth.HashSecret(token)).Scan(&org, &source)
	if isNoRows(err) {
		return fail(c, 401, "unauthorized_source", "A valid source token is required.")
	}
	if err != nil {
		return internal(c)
	}
	accepted, duplicates := 0, 0
	for i, e := range in.Events {
		res, err := tx.Exec(c.UserContext(), `INSERT INTO events(organization_id,source_id,source_sequence,original_timestamp,observed_at,asset_id,category,action,source_ip,destination_ip,message)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(organization_id,source_id,observed_at,source_sequence) DO NOTHING`, org, source, e.SourceSequence, e.OriginalTimestamp, times[i], optional(e.AssetID), e.Category, e.Action, optional(e.SourceIP), optional(e.DestinationIP), e.Message)
		if foreignKeyError(err) {
			return fail(c, 400, "invalid_reference", "An asset reference is invalid for this source.")
		}
		if err != nil {
			return internal(c)
		}
		if res.RowsAffected() == 1 {
			accepted++
		} else {
			duplicates++
		}
	}
	if _, err = tx.Exec(c.UserContext(), `UPDATE sources SET last_received_at=now() WHERE organization_id=$1 AND id=$2`, org, source); err != nil {
		return internal(c)
	}
	if err = db.AppendAudit(c.UserContext(), tx, org, "source:"+source, "event.batch_ingested", "source", source, metadata(c, fiber.Map{"accepted": accepted, "duplicates": duplicates})); err != nil {
		return internal(c)
	}
	if err = tx.Commit(c.UserContext()); err != nil {
		return internal(c)
	}
	return c.JSON(fiber.Map{"accepted": accepted, "duplicates": duplicates})
}

const eventColumns = `id::text,source_id::text,source_sequence,original_timestamp,observed_at,asset_id::text,category,action,host(source_ip),host(destination_ip),message,ingested_at`

func scanEvent(row pgx.Row) (fiber.Map, error) {
	var id, source, seq, original, category, action, message string
	var asset, srcIP, dstIP *string
	var observed, ingested time.Time
	err := row.Scan(&id, &source, &seq, &original, &observed, &asset, &category, &action, &srcIP, &dstIP, &message, &ingested)
	if err != nil {
		return nil, err
	}
	return fiber.Map{"id": id, "source_id": source, "source_sequence": seq, "original_timestamp": original, "observed_at": observed, "asset_id": asset, "category": category, "action": action, "source_ip": srcIP, "destination_ip": dstIP, "message": message, "ingested_at": ingested}, nil
}
func (s *Server) eventsGet(c *fiber.Ctx) error {
	if !validID(c.Params("id")) {
		return bad(c)
	}
	p := principal(c)
	out, err := scanEvent(s.pool.QueryRow(c.UserContext(), `SELECT `+eventColumns+` FROM events WHERE organization_id=$1 AND id=$2`, p.OrganizationID, c.Params("id")))
	if isNoRows(err) {
		return absent(c)
	}
	if err != nil {
		return internal(c)
	}
	return c.JSON(out)
}
func (s *Server) eventsList(c *fiber.Ctx) error {
	limit, offset, err := page(c)
	if err != nil {
		return bad(c)
	}
	p := principal(c)
	var from, to any
	if raw := c.Query("from"); raw != "" {
		t, e := time.Parse(time.RFC3339Nano, raw)
		if e != nil {
			return bad(c)
		}
		from = t.UTC()
	}
	if raw := c.Query("to"); raw != "" {
		t, e := time.Parse(time.RFC3339Nano, raw)
		if e != nil {
			return bad(c)
		}
		to = t.UTC()
	}
	if from != nil && to != nil && !from.(time.Time).Before(to.(time.Time)) {
		return bad(c)
	}
	source, asset, category, ip := c.Query("source_id"), c.Query("asset_id"), c.Query("category"), c.Query("source_ip")
	if (source != "" && !validID(source)) || (asset != "" && !validID(asset)) || len(category) > 100 || !validIP(ip) {
		return bad(c)
	}
	rows, err := s.pool.Query(c.UserContext(), `SELECT `+eventColumns+` FROM events WHERE organization_id=$1
        AND ($2::timestamptz IS NULL OR observed_at >= $2) AND ($3::timestamptz IS NULL OR observed_at < $3)
        AND ($4::uuid IS NULL OR source_id=$4) AND ($5::uuid IS NULL OR asset_id=$5)
        AND ($6::text IS NULL OR category=$6) AND ($7::inet IS NULL OR source_ip=$7)
        ORDER BY observed_at DESC,id DESC LIMIT $8 OFFSET $9`, p.OrganizationID, from, to, optional(source), optional(asset), optional(category), optional(ip), limit, offset)
	if err != nil {
		return internal(c)
	}
	defer rows.Close()
	items := []fiber.Map{}
	for rows.Next() {
		m, err := scanEvent(rows)
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
