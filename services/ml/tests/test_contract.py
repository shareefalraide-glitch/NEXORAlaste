"""FastAPI's preview routes and observed responses match the checked-in contract."""
import json
from pathlib import Path

from fastapi.testclient import TestClient
from jsonschema import Draft202012Validator, FormatChecker

from app.main import app


ROOT = Path(__file__).resolve().parents[3]
SPEC = json.loads((ROOT / "contracts/ml-preview.openapi.json").read_text(encoding="utf-8"))
TOKEN = "test-only-service-token-at-least-32-characters"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def validate_response(path, method, response):
    documented = SPEC["paths"][path][method]["responses"][str(response.status_code)]
    schema = dict(documented["content"]["application/json"]["schema"])
    # Resolve local #/components/... references against the complete document.
    schema["components"] = SPEC["components"]
    Draft202012Validator(schema, format_checker=FormatChecker()).validate(response.json())


def test_preview_route_inventory():
    expected = {
        (method.upper(), path)
        for path, item in SPEC["paths"].items()
        for method in item
        if method in {"get", "post", "patch", "put", "delete"}
    }
    actual = {
        (method, route.path)
        for route in app.routes
        for method in getattr(route, "methods", set())
        if method in {"GET", "POST", "PATCH", "PUT", "DELETE"}
    }
    assert actual == expected


def test_response_schemas_for_success_and_rejections(monkeypatch):
    monkeypatch.setenv("NEXORA_ML_SERVICE_TOKEN", TOKEN)
    body = {"rule_score": 0, "asset_criticality": "critical", "frequency_score": 1}
    request_schema = dict(SPEC["paths"]["/internal/v1/risk-preview"]["post"]["requestBody"]["content"]["application/json"]["schema"])
    request_schema["components"] = SPEC["components"]
    Draft202012Validator(request_schema, format_checker=FormatChecker()).validate(body)
    with TestClient(app) as client:
        for path in ("/health/live", "/health/ready"):
            response = client.get(path)
            assert response.status_code == 200
            validate_response(path, "get", response)
        path = "/internal/v1/risk-preview"
        for payload, headers, status in (
            (body, HEADERS, 200),
            (body, {}, 401),
            ({**body, "anomaly_score": 1}, HEADERS, 409),
            ({**body, "frequency_score": "not-a-number"}, HEADERS, 422),
        ):
            response = client.post(path, json=payload, headers=headers)
            assert response.status_code == status
            validate_response(path, "post", response)
        monkeypatch.delenv("NEXORA_ML_SERVICE_TOKEN")
        response = client.get("/health/ready")
        assert response.status_code == 503
        validate_response("/health/ready", "get", response)
