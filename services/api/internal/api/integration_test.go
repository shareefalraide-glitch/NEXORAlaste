package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"nexora.local/nexora/services/api/internal/config"
	"nexora.local/nexora/services/api/internal/db"
)

// NEXORA_TEST_DATABASE_URL must point to a disposable PostgreSQL database.
// Every run gets its own schema, which is removed afterwards.
func testDatabase(t *testing.T) *pgxpool.Pool {
	t.Helper()
	url := os.Getenv("NEXORA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set NEXORA_TEST_DATABASE_URL to run integration tests")
	}
	ctx := context.Background()
	base, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	name := "test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err = base.Exec(ctx, `CREATE SCHEMA `+name); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = name
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { pool.Close(); _, _ = base.Exec(ctx, `DROP SCHEMA `+name+` CASCADE`); base.Close() })
	if err = db.Migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err = db.Migrate(ctx, pool); err != nil {
		t.Fatalf("repeat migration: %v", err)
	}
	return pool
}

type response struct {
	code int
	body map[string]any
}

func call(t *testing.T, app *fiber.App, method, path string, body any, headers map[string]string) response {
	t.Helper()
	var data []byte
	if body != nil {
		var err error
		data, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(data))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := app.Test(req, -1)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	out := response{code: resp.StatusCode, body: map[string]any{}}
	if resp.StatusCode != 204 {
		if err = json.NewDecoder(resp.Body).Decode(&out.body); err != nil {
			t.Fatalf("decode %s %s: %v", method, path, err)
		}
	}
	return out
}
func check(t *testing.T, r response, want int) {
	t.Helper()
	if r.code != want {
		t.Fatalf("expected %d got %d: %#v", want, r.code, r.body)
	}
}
func bearer(token string) map[string]string {
	return map[string]string{"Authorization": "Bearer " + token}
}
func str(t *testing.T, m map[string]any, key string) string {
	t.Helper()
	v, ok := m[key].(string)
	if !ok {
		t.Fatalf("missing string %s: %#v", key, m)
	}
	return v
}
func loginAs(t *testing.T, app *fiber.App, org, email string) response {
	t.Helper()
	r := call(t, app, "POST", "/api/v1/auth/login", map[string]any{"organization": org, "email": email, "password": "temporary-password-for-testing-only"}, nil)
	check(t, r, 200)
	return r
}

func TestAPIIntegration(t *testing.T) {
	pool := testDatabase(t)
	ctx := context.Background()
	for _, org := range []string{"alpha", "bravo"} {
		if err := db.Bootstrap(ctx, pool, org, org, "admin@example.test", "temporary-password-for-testing-only"); err != nil {
			t.Fatal(err)
		}
	}
	cfg := config.Config{JWTSecret: []byte("testing-only-secret-with-more-than-thirty-two-bytes")}
	app, err := New(pool, cfg)
	if err != nil {
		t.Fatal(err)
	}
	check(t, call(t, app, "GET", "/health/live", nil, nil), 200)
	check(t, call(t, app, "GET", "/health/ready", nil, nil), 200)
	check(t, call(t, app, "POST", "/internal/v1/events-something", nil, nil), 404)
	check(t, call(t, app, "GET", "/api/v1/assets", nil, nil), 401)
	a := loginAs(t, app, "alpha", "admin@example.test")
	b := loginAs(t, app, "bravo", "admin@example.test")
	tokenA, tokenB := str(t, a.body, "access_token"), str(t, b.body, "access_token")
	headerA, headerB := bearer(tokenA), bearer(tokenB)
	me := call(t, app, "GET", "/api/v1/auth/me", nil, headerA)
	check(t, me, 200)
	adminID := str(t, me.body, "id")
	viewer := call(t, app, "POST", "/api/v1/users", map[string]any{"email": "viewer@example.test", "password": "temporary-password-for-testing-only", "role": "viewer"}, headerA)
	check(t, viewer, 201)
	v := loginAs(t, app, "alpha", "viewer@example.test")
	headerV := bearer(str(t, v.body, "access_token"))
	check(t, call(t, app, "POST", "/api/v1/assets", map[string]any{"name": "denied", "kind": "server", "criticality": "low"}, headerV), 403)
	check(t, call(t, app, "GET", "/api/v1/audit", nil, headerV), 403)
	asset := call(t, app, "POST", "/api/v1/assets", map[string]any{"name": "AD-SRV-01", "kind": "server", "criticality": "critical", "primary_ip": "192.0.2.10"}, headerA)
	check(t, asset, 201)
	assetID := str(t, asset.body, "id")
	check(t, call(t, app, "GET", "/api/v1/assets/"+assetID, nil, headerA), 200)
	check(t, call(t, app, "GET", "/api/v1/assets/"+assetID, nil, headerB), 404)
	check(t, call(t, app, "PATCH", "/api/v1/assets/"+assetID, map[string]any{"criticality": "low"}, headerV), 403)
	check(t, call(t, app, "PATCH", "/api/v1/assets/"+assetID, map[string]any{"criticality": "low"}, headerB), 404)
	updatedAsset := call(t, app, "PATCH", "/api/v1/assets/"+assetID, map[string]any{"criticality": "medium", "primary_ip": ""}, headerA)
	check(t, updatedAsset, 200)
	if updatedAsset.body["criticality"] != "medium" || updatedAsset.body["primary_ip"] != nil {
		t.Fatal("asset update/clear failed")
	}

	assetB := call(t, app, "POST", "/api/v1/assets", map[string]any{"name": "other org", "kind": "server", "criticality": "low"}, headerB)
	check(t, assetB, 201)
	source := call(t, app, "POST", "/api/v1/sources", map[string]any{"name": "sensor-alpha", "kind": "sensor", "collection_method": "vector-ecs"}, headerA)
	check(t, source, 201)
	sourceID := str(t, source.body["source"].(map[string]any), "id")
	check(t, call(t, app, "GET", "/api/v1/sources/"+sourceID, nil, headerA), 200)
	check(t, call(t, app, "GET", "/api/v1/sources/"+sourceID, nil, headerB), 404)
	sourceToken := str(t, source.body, "ingest_token")
	sourceHeader := map[string]string{"X-Source-Token": sourceToken}
	e := map[string]any{"source_sequence": "seq-001", "original_timestamp": "2026-01-01T03:00:00+03:00", "asset_id": assetID, "category": "authentication", "action": "failure", "source_ip": "192.0.2.40", "message": "failed login"}
	check(t, call(t, app, "POST", "/internal/v1/event-batches", map[string]any{"events": []any{e}}, nil), 401)
	ingested := call(t, app, "POST", "/internal/v1/event-batches", map[string]any{"events": []any{e}}, sourceHeader)
	check(t, ingested, 200)
	if ingested.body["accepted"] != float64(1) {
		t.Fatalf("unexpected ingest: %#v", ingested.body)
	}
	retry := call(t, app, "POST", "/internal/v1/event-batches", map[string]any{"events": []any{e}}, sourceHeader)
	check(t, retry, 200)
	if retry.body["duplicates"] != float64(1) {
		t.Fatalf("dedupe failed: %#v", retry.body)
	}
	rotSource := call(t, app, "POST", "/api/v1/sources/"+sourceID+"/token-rotations", nil, headerA)
	check(t, rotSource, 200)
	check(t, call(t, app, "POST", "/internal/v1/event-batches", map[string]any{"events": []any{e}}, sourceHeader), 401)
	sourceHeader = map[string]string{"X-Source-Token": str(t, rotSource.body, "ingest_token")}
	check(t, call(t, app, "POST", "/api/v1/sources/"+sourceID+"/token-revocations", nil, headerA), 204)
	check(t, call(t, app, "POST", "/internal/v1/event-batches", map[string]any{"events": []any{e}}, sourceHeader), 401)
	rotSource = call(t, app, "POST", "/api/v1/sources/"+sourceID+"/token-rotations", nil, headerA)
	check(t, rotSource, 200)
	sourceHeader = map[string]string{"X-Source-Token": str(t, rotSource.body, "ingest_token")}

	// A batch with a cross-tenant reference rolls back the preceding valid row too.
	first := map[string]any{"source_sequence": "seq-002", "original_timestamp": "2026-01-01T03:00:01+03:00", "asset_id": assetID, "category": "network", "action": "connect"}
	foreign := map[string]any{"source_sequence": "seq-003", "original_timestamp": "2026-01-01T03:00:02+03:00", "asset_id": str(t, assetB.body, "id"), "category": "network", "action": "connect"}
	check(t, call(t, app, "POST", "/internal/v1/event-batches", map[string]any{"events": []any{first, foreign}}, sourceHeader), 400)
	events := call(t, app, "GET", "/api/v1/events?from=2026-01-01T00:00:00Z&to=2026-01-01T00:00:01Z", nil, headerA)
	check(t, events, 200)
	items := events.body["items"].([]any)
	if len(items) != 1 {
		t.Fatalf("events or half-open bounds incorrect: %#v", events.body)
	}
	event := items[0].(map[string]any)
	if event["original_timestamp"] != "2026-01-01T03:00:00+03:00" || event["observed_at"] != "2026-01-01T00:00:00Z" {
		t.Fatalf("timestamp mismatch: %#v", event)
	}
	check(t, call(t, app, "GET", "/api/v1/events/"+str(t, event, "id"), nil, headerB), 404)
	allEvents := call(t, app, "GET", "/api/v1/events", nil, headerA)
	if len(allEvents.body["items"].([]any)) != 1 {
		t.Fatal("failed batch was not rolled back")
	}
	incident := call(t, app, "POST", "/api/v1/incidents", map[string]any{"title": "Manual review", "severity": "high", "asset_id": assetID}, headerA)
	check(t, incident, 201)
	id := str(t, incident.body, "id")
	if incident.body["origin"] != "manual" {
		t.Fatal("manual origin not disclosed")
	}
	check(t, call(t, app, "GET", "/api/v1/incidents/"+id, nil, headerB), 404)
	check(t, call(t, app, "POST", "/api/v1/incidents/"+id+"/transitions", map[string]any{"to_status": "closed", "root_cause": "no"}, headerA), 409)
	check(t, call(t, app, "POST", "/api/v1/incidents/"+id+"/transitions", map[string]any{"to_status": "assigned", "assignee_id": adminID}, headerA), 200)
	check(t, call(t, app, "POST", "/api/v1/incidents/"+id+"/transitions", map[string]any{"to_status": "investigating"}, headerA), 200)
	blocked := call(t, app, "POST", "/api/v1/incidents/"+id+"/transitions", map[string]any{"to_status": "contained"}, headerA)
	check(t, blocked, 409)
	if blocked.body["error"].(map[string]any)["code"] != "containment_unavailable" {
		t.Fatal("containment did not fail closed")
	}
	check(t, call(t, app, "POST", "/api/v1/incidents/"+id+"/notes", map[string]any{"body": "Documented analyst observation"}, headerA), 201)
	notes := call(t, app, "GET", "/api/v1/incidents/"+id+"/notes", nil, headerA)
	check(t, notes, 200)
	if len(notes.body["items"].([]any)) != 1 {
		t.Fatal("note not persisted")
	}
	check(t, call(t, app, "GET", "/api/v1/incidents/"+id+"/notes", nil, headerB), 404)
	task := call(t, app, "POST", "/api/v1/incidents/"+id+"/tasks", map[string]any{"title": "Review evidence", "assignee_id": adminID}, headerA)
	check(t, task, 201)
	taskID := str(t, task.body, "id")
	check(t, call(t, app, "GET", "/api/v1/incidents/"+id+"/tasks", nil, headerA), 200)
	check(t, call(t, app, "PATCH", "/api/v1/incidents/"+id+"/tasks/"+taskID, map[string]any{"status": "done"}, headerV), 403)
	task = call(t, app, "PATCH", "/api/v1/incidents/"+id+"/tasks/"+taskID, map[string]any{"status": "done", "assignee_id": ""}, headerA)
	check(t, task, 200)
	if task.body["status"] != "done" || task.body["assignee_id"] != nil {
		t.Fatal("task update not persisted")
	}
	check(t, call(t, app, "GET", "/api/v1/incidents/"+id+"/tasks", nil, headerB), 404)
	summary := call(t, app, "GET", "/api/v1/dashboard/summary", nil, headerA)
	check(t, summary, 200)
	if summary.body["counts"].(map[string]any)["alerts"] != nil || summary.body["data_status"].(map[string]any)["detection"] != "not_implemented" {
		t.Fatal("dashboard concealed unavailable detection")
	}

	verify := call(t, app, "GET", "/api/v1/audit/verify", nil, headerA)
	check(t, verify, 200)
	if verify.body["valid"] != true || verify.body["complete"] != true {
		t.Fatalf("invalid audit: %#v", verify.body)
	}
	if _, err = pool.Exec(ctx, `UPDATE audit_entries SET action='tampered' WHERE id=(SELECT min(id) FROM audit_entries)`); err == nil {
		t.Fatal("audit mutation trigger did not reject UPDATE")
	}
	rotated := call(t, app, "POST", "/api/v1/auth/refresh", map[string]any{"refresh_token": str(t, a.body, "refresh_token")}, nil)
	check(t, rotated, 200)
	check(t, call(t, app, "POST", "/api/v1/auth/refresh", map[string]any{"refresh_token": str(t, a.body, "refresh_token")}, nil), 401)
	newAccess := str(t, rotated.body, "access_token")
	check(t, call(t, app, "POST", "/api/v1/auth/logout", nil, bearer(newAccess)), 204)
	check(t, call(t, app, "GET", "/api/v1/auth/me", nil, bearer(newAccess)), 401)
	check(t, call(t, app, "GET", "/api/v1/auth/me", nil, headerA), 401)
	// The DB owner can disable triggers. Verify detects content changes; this is
	// NOT an external anchor and cannot prove that the tail was never removed.
	if _, err = pool.Exec(ctx, `ALTER TABLE audit_entries DISABLE TRIGGER audit_no_update_delete`); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `UPDATE audit_entries SET action='tampered' WHERE id=(SELECT min(id) FROM audit_entries)`); err != nil {
		t.Fatal(err)
	}
	if _, err = pool.Exec(ctx, `ALTER TABLE audit_entries ENABLE TRIGGER audit_no_update_delete`); err != nil {
		t.Fatal(err)
	}
	orgID := str(t, me.body, "organization_id")
	result, err := db.VerifyAudit(ctx, pool, orgID)
	if err != nil || result.Valid {
		t.Fatalf("tampering not detected: %+v %v", result, err)
	}
}

func TestConcurrentAuditHasOneChain(t *testing.T) {
	pool := testDatabase(t)
	ctx := context.Background()
	if err := db.Bootstrap(ctx, pool, "parallel", "Parallel", "admin@example.test", "temporary-password-for-testing-only"); err != nil {
		t.Fatal(err)
	}
	var org string
	if err := pool.QueryRow(ctx, `SELECT id::text FROM organizations WHERE slug='parallel'`).Scan(&org); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errors := make(chan error, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			tx, err := pool.Begin(ctx)
			if err != nil {
				errors <- err
				return
			}
			defer tx.Rollback(ctx)
			if err = db.AppendAudit(ctx, tx, org, "test", "parallel", "test", fmt.Sprint(i), map[string]any{"n": i}); err != nil {
				errors <- err
				return
			}
			if err = tx.Commit(ctx); err != nil {
				errors <- err
			}
		}(i)
	}
	wg.Wait()
	close(errors)
	for err := range errors {
		t.Error(err)
	}
	v, err := db.VerifyAudit(ctx, pool, org)
	if err != nil || !v.Valid || !v.Complete || v.Checked != 21 {
		t.Fatalf("audit chain forked: %+v %v", v, err)
	}
}

var _ = http.MethodGet

func TestReadinessRejectsChangedMigration(t *testing.T) {
	pool := testDatabase(t)
	ctx := context.Background()
	if err := db.Ready(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `UPDATE schema_migrations SET checksum='altered' WHERE version='001_core.sql'`); err != nil {
		t.Fatal(err)
	}
	if err := db.Ready(ctx, pool); err == nil {
		t.Fatal("readiness accepted a changed migration")
	}
	if err := db.Migrate(ctx, pool); err == nil {
		t.Fatal("migration did not reject a checksum mismatch")
	}
}
