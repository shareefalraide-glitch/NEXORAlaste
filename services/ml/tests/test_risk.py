from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from app.main import app

TOKEN = "temporary-test-token-at-least-32-characters"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}


def base(**changes):
    return {"rule_score": 0.0, "asset_criticality": "critical", "frequency_score": 1.0, **changes}


def test_fails_closed_without_service_token(monkeypatch):
    monkeypatch.delenv("NEXORA_ML_SERVICE_TOKEN", raising=False)
    with TestClient(app) as client:
        assert client.get("/health/live").status_code == 200
        assert client.get("/health/ready").status_code == 503
        assert client.post("/internal/v1/risk-preview", json=base(), headers=HEADERS).status_code == 503


def test_no_detection_signals_does_not_trigger_alert(monkeypatch):
    monkeypatch.setenv("NEXORA_ML_SERVICE_TOKEN", TOKEN)
    with TestClient(app) as client:
        assert client.post("/internal/v1/risk-preview", json=base()).status_code == 401
        response = client.post("/internal/v1/risk-preview", json=base(), headers=HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["risk_score"] == 0.20 and data["severity"] == "low"
        assert data["operational"] is False and data["model_status"] == "not_implemented"


def test_cold_start_and_baseline_paths(monkeypatch):
    monkeypatch.setenv("NEXORA_ML_SERVICE_TOKEN", TOKEN)
    now = datetime.now(timezone.utc)
    with TestClient(app) as client:
        cold = base(anomaly_score=0.9, baseline={"started_at": now.isoformat(), "normalized_event_count": 99999})
        assert client.post("/internal/v1/risk-preview", json=cold, headers=HEADERS).status_code == 409
        by_count = base(anomaly_score=1.0, rule_score=1.0, baseline={"started_at": now.isoformat(), "normalized_event_count": 100000})
        result = client.post("/internal/v1/risk-preview", json=by_count, headers=HEADERS)
        assert result.status_code == 200 and result.json()["severity"] == "critical"
        by_time = base(anomaly_score=0.0, baseline={"started_at": (now-timedelta(days=14, seconds=1)).isoformat(), "normalized_event_count": 1})
        assert client.post("/internal/v1/risk-preview", json=by_time, headers=HEADERS).json()["baseline_ready"] is True
        future = base(baseline={"started_at": (now+timedelta(days=1)).isoformat(), "normalized_event_count": 100000})
        assert client.post("/internal/v1/risk-preview", json=future, headers=HEADERS).status_code == 422


def test_ranges_and_strict_input(monkeypatch):
    monkeypatch.setenv("NEXORA_ML_SERVICE_TOKEN", TOKEN)
    with TestClient(app) as client:
        for payload in [
            base(rule_score=1.01), base(frequency_score=-0.1), base(unknown="x"),
            base(rule_score="0.5"), base(rule_score=True),
            base(baseline={"started_at": 0, "normalized_event_count": 1}),
            base(baseline={"started_at": "2020-01-01T00:00:00Z", "normalized_event_count": "5"}),
        ]:
            assert client.post("/internal/v1/risk-preview", json=payload, headers=HEADERS).status_code == 422
        high = client.post("/internal/v1/risk-preview", json=base(rule_score=1.0), headers=HEADERS).json()
        assert high["risk_score"] == 0.65 and high["severity"] == "high"
