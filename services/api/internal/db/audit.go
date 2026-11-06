package db

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AuditEntry struct {
	ID           int64           `json:"id"`
	OccurredAt   time.Time       `json:"occurred_at"`
	Actor        string          `json:"actor"`
	Action       string          `json:"action"`
	ResourceType string          `json:"resource_type"`
	ResourceID   string          `json:"resource_id"`
	Payload      json.RawMessage `json:"payload"`
	PreviousHash string          `json:"previous_hash"`
	EntryHash    string          `json:"entry_hash"`
}

type auditCanonical struct {
	OrganizationID string          `json:"organization_id"`
	OccurredAt     time.Time       `json:"occurred_at"`
	Actor          string          `json:"actor"`
	Action         string          `json:"action"`
	ResourceType   string          `json:"resource_type"`
	ResourceID     string          `json:"resource_id"`
	Payload        json.RawMessage `json:"payload"`
}

func digest(organizationID string, e AuditEntry) (string, error) {
	canonical, err := json.Marshal(auditCanonical{organizationID, e.OccurredAt.UTC(), e.Actor, e.Action, e.ResourceType, e.ResourceID, e.Payload})
	if err != nil {
		return "", err
	}
	h := sha256.Sum256(append([]byte(e.PreviousHash+"\n"), canonical...))
	return hex.EncodeToString(h[:]), nil
}

// AppendAudit must be called in the SAME transaction as the sensitive change.
// A per-organization advisory lock prevents concurrent writers from forking.
func AppendAudit(ctx context.Context, tx pgx.Tx, org, actor, action, kind, id string, payload any) error {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended('nexora-audit:' || $1, 0))`, org); err != nil {
		return err
	}
	prev := strings.Repeat("0", 64)
	err := tx.QueryRow(ctx, `SELECT entry_hash FROM audit_entries WHERE organization_id=$1 ORDER BY id DESC LIMIT 1`, org).Scan(&prev)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	e := AuditEntry{OccurredAt: time.Now().UTC().Truncate(time.Microsecond), Actor: actor, Action: action, ResourceType: kind, ResourceID: id, Payload: body, PreviousHash: prev}
	e.EntryHash, err = digest(org, e)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO audit_entries(organization_id,occurred_at,actor,action,resource_type,resource_id,payload,previous_hash,entry_hash)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, org, e.OccurredAt, e.Actor, e.Action, e.ResourceType, e.ResourceID, string(body), e.PreviousHash, e.EntryHash)
	return err
}

func ReadAudit(ctx context.Context, pool *pgxpool.Pool, org string, limit int) ([]AuditEntry, error) {
	rows, err := pool.Query(ctx, `SELECT id,occurred_at,actor,action,resource_type,resource_id,payload,previous_hash,entry_hash
        FROM audit_entries WHERE organization_id=$1 ORDER BY id DESC LIMIT $2`, org, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		var payload string
		if err := rows.Scan(&e.ID, &e.OccurredAt, &e.Actor, &e.Action, &e.ResourceType, &e.ResourceID, &payload, &e.PreviousHash, &e.EntryHash); err != nil {
			return nil, err
		}
		e.Payload = json.RawMessage(payload)
		out = append(out, e)
	}
	return out, rows.Err()
}

type Verification struct {
	Valid    bool   `json:"valid"`
	Complete bool   `json:"complete"`
	Checked  int    `json:"checked"`
	Message  string `json:"message"`
}

// Verifies from genesis, up to a bounded limit. Without external anchoring a
// privileged database operator can still truncate/rewrite the whole chain.
func VerifyAudit(ctx context.Context, pool *pgxpool.Pool, org string) (Verification, error) {
	const max = 10000
	rows, err := pool.Query(ctx, `SELECT id,occurred_at,actor,action,resource_type,resource_id,payload,previous_hash,entry_hash
        FROM audit_entries WHERE organization_id=$1 ORDER BY id ASC LIMIT $2`, org, max+1)
	if err != nil {
		return Verification{}, err
	}
	defer rows.Close()
	result := Verification{Valid: true, Complete: true, Message: "No external anchor is checked."}
	prev := strings.Repeat("0", 64)
	for rows.Next() {
		var e AuditEntry
		var payload string
		if err := rows.Scan(&e.ID, &e.OccurredAt, &e.Actor, &e.Action, &e.ResourceType, &e.ResourceID, &payload, &e.PreviousHash, &e.EntryHash); err != nil {
			return Verification{}, err
		}
		if result.Checked == max {
			result.Complete = false
			result.Valid = false
			result.Message = "Scan limit reached; full chain not verified."
			break
		}
		e.Payload = json.RawMessage(payload)
		got, err := digest(org, e)
		if err != nil {
			return Verification{}, fmt.Errorf("invalid audit data")
		}
		result.Checked++
		if e.PreviousHash != prev || e.EntryHash != got {
			result.Valid = false
			result.Message = "Chain mismatch detected; no external anchor is checked."
			break
		}
		prev = e.EntryHash
	}
	if err := rows.Err(); err != nil {
		return Verification{}, err
	}
	return result, nil
}
