#!/usr/bin/env python3
"""Destructive localhost-only contract smoke against a disposable database.

Set NEXORA_SMOKE_ALLOW_WRITES=1 and the four NEXORA_SMOKE_* connection/login
variables. Never use this against production or real organization data.
"""
import json
import os
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from jsonschema import Draft202012Validator, FormatChecker

if os.getenv("NEXORA_SMOKE_ALLOW_WRITES") != "1":
    raise SystemExit("Refusing to create test records; set NEXORA_SMOKE_ALLOW_WRITES=1 on a disposable DB")
base = os.environ["NEXORA_SMOKE_BASE_URL"].rstrip("/")
parsed = urlparse(base)
if parsed.scheme != "http" or parsed.hostname not in {"localhost", "127.0.0.1", "::1"}:
    raise SystemExit("Smoke tests are restricted to localhost HTTP")
org, email, password = (os.environ[k] for k in ("NEXORA_SMOKE_ORG", "NEXORA_SMOKE_EMAIL", "NEXORA_SMOKE_PASSWORD"))
spec = json.loads((Path(__file__).resolve().parents[1] / "contracts/openapi.json").read_text(encoding="utf-8"))
covered = set()


def resolve_local_refs(value):
    if isinstance(value, list):
        return [resolve_local_refs(item) for item in value]
    if not isinstance(value, dict):
        return value
    if "$ref" in value:
        reference = value["$ref"]
        if not reference.startswith("#/"):
            raise ValueError("external references are not allowed in smoke checks")
        target = spec
        for component in reference[2:].split("/"):
            target = target[component.replace("~1", "/").replace("~0", "~")]
        return {**resolve_local_refs(target), **{key: resolve_local_refs(item) for key, item in value.items() if key != "$ref"}}
    return {key: resolve_local_refs(item) for key, item in value.items()}


def request(method, template, path, expected, payload=None, headers=None):
    raw = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base + path, data=raw, method=method, headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as response:
        status, body = response.code, response.read()
    if status != expected:
        raise AssertionError(f"{method} {template}: expected {expected}, got {status}")
    operation = spec["paths"][template][method.lower()]
    response_schema = operation["responses"][str(status)].get("content", {}).get("application/json", {}).get("schema")
    value = json.loads(body) if body else None
    if response_schema:
        Draft202012Validator(resolve_local_refs(response_schema), format_checker=FormatChecker()).validate(value)
    if status < 400:
        covered.add((method.lower(), template))
    return value


def bearer(token):
    return {"Authorization": "Bearer " + token}


request("GET", "/health/live", "/health/live", 200)
request("GET", "/health/ready", "/health/ready", 200)
request("GET", "/api/v1/assets", "/api/v1/assets", 401)
tokens = request("POST", "/api/v1/auth/login", "/api/v1/auth/login", 200, {"organization": org, "email": email, "password": password})
h = bearer(tokens["access_token"])
me = request("GET", "/api/v1/auth/me", "/api/v1/auth/me", 200, headers=h)
unique = uuid.uuid4().hex[:12]
request("GET", "/api/v1/users", "/api/v1/users", 200, headers=h)
request("POST", "/api/v1/users", "/api/v1/users", 201, {"email": f"viewer-{unique}@example.invalid", "password": "local-contract-test-password-only", "role": "viewer"}, h)
request("GET", "/api/v1/assets", "/api/v1/assets", 200, headers=h)
asset = request("POST", "/api/v1/assets", "/api/v1/assets", 201, {"name": f"test-{unique}", "kind": "server", "criticality": "medium", "primary_ip": "192.0.2.100"}, h)
request("GET", "/api/v1/assets/{id}", "/api/v1/assets/" + asset["id"], 200, headers=h)
request("PATCH", "/api/v1/assets/{id}", "/api/v1/assets/" + asset["id"], 200, {"criticality":"critical"}, h)
request("GET", "/api/v1/sources", "/api/v1/sources", 200, headers=h)
source = request("POST", "/api/v1/sources", "/api/v1/sources", 201, {"name": f"sensor-{unique}", "kind": "sensor", "collection_method": "contract-test"}, h)
source_id = source["source"]["id"]
request("GET", "/api/v1/sources/{id}", "/api/v1/sources/" + source_id, 200, headers=h)
source = request("POST", "/api/v1/sources/{id}/token-rotations", "/api/v1/sources/" + source_id + "/token-rotations", 200, headers=h)
event = {"source_sequence": unique, "original_timestamp": datetime.now(timezone.utc).isoformat(), "asset_id": asset["id"], "category": "test", "action": "contract_check"}
request("POST", "/internal/v1/event-batches", "/internal/v1/event-batches", 200, {"events": [event]}, {"X-Source-Token": source["ingest_token"]})
request("POST", "/api/v1/sources/{id}/token-revocations", "/api/v1/sources/" + source_id + "/token-revocations", 204, headers=h)
events = request("GET", "/api/v1/events", "/api/v1/events?limit=1", 200, headers=h)
request("GET", "/api/v1/events/{id}", "/api/v1/events/" + events["items"][0]["id"], 200, headers=h)
request("GET", "/api/v1/incidents", "/api/v1/incidents", 200, headers=h)
incident = request("POST", "/api/v1/incidents", "/api/v1/incidents", 201, {"title": f"manual-test-{unique}", "severity": "medium", "asset_id": asset["id"]}, h)
id = incident["id"]
request("GET", "/api/v1/incidents/{id}", "/api/v1/incidents/" + id, 200, headers=h)
request("POST", "/api/v1/incidents/{id}/transitions", "/api/v1/incidents/" + id + "/transitions", 200, {"to_status": "assigned", "assignee_id": me["id"]}, h)
request("POST", "/api/v1/incidents/{id}/notes", "/api/v1/incidents/" + id + "/notes", 201, {"body": "Contract smoke test observation"}, h)
request("GET", "/api/v1/incidents/{id}/notes", "/api/v1/incidents/" + id + "/notes", 200, headers=h)
task = request("POST", "/api/v1/incidents/{id}/tasks", "/api/v1/incidents/" + id + "/tasks", 201, {"title":"Contract test"}, h)
request("GET", "/api/v1/incidents/{id}/tasks", "/api/v1/incidents/" + id + "/tasks", 200, headers=h)
request("PATCH", "/api/v1/incidents/{id}/tasks/{task_id}", "/api/v1/incidents/" + id + "/tasks/" + task["id"], 200, {"status":"done"}, h)
summary = request("GET", "/api/v1/dashboard/summary", "/api/v1/dashboard/summary", 200, headers=h)
if summary["counts"]["alerts"] is not None or summary["data_status"]["detection"] != "not_implemented":
    raise AssertionError("Missing detection must not be presented as zero")

request("GET", "/api/v1/audit", "/api/v1/audit", 200, headers=h)
result = request("GET", "/api/v1/audit/verify", "/api/v1/audit/verify", 200, headers=h)
if not result["valid"] or not result["complete"]:
    raise AssertionError("audit chain verification did not pass")
rotated = request("POST", "/api/v1/auth/refresh", "/api/v1/auth/refresh", 200, {"refresh_token": tokens["refresh_token"]})
request("POST", "/api/v1/auth/logout", "/api/v1/auth/logout", 204, headers=bearer(rotated["access_token"]))
request("GET", "/api/v1/auth/me", "/api/v1/auth/me", 401, headers=h)
expected = {(method, path) for path, obj in spec["paths"].items() for method in obj if method in {"get", "post", "patch", "put", "delete"}}
if covered != expected:
    raise AssertionError(f"Smoke did not cover: {expected - covered}")
print(f"PASS real localhost HTTP responses match documented success schemas for {len(covered)} implemented operations")
