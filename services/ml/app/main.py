"""L3 research-preview calculation only; this is not a trained detector."""
from __future__ import annotations

import hmac
import os
from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator

app = FastAPI(
    title="NEXORA L3 risk calculation preview",
    version="0.1.0",
    description="Internal, non-operational arithmetic preview. No model, calibration, rules or alerting are implemented.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
Score = Annotated[float, Field(ge=0.0, le=1.0, allow_inf_nan=False, strict=True)]


class Baseline(BaseModel):
    model_config = ConfigDict(extra="forbid")
    started_at: datetime
    normalized_event_count: int = Field(ge=0, le=10_000_000_000, strict=True)

    @field_validator("started_at", mode="before")
    @classmethod
    def timestamp_is_string(cls, value):
        if not isinstance(value, str):
            raise ValueError("started_at must be a timestamp string")
        return value

    @field_validator("started_at")
    @classmethod
    def must_have_offset(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("started_at must include a timezone offset")
        return value.astimezone(timezone.utc)


class RiskPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rule_score: Score
    anomaly_score: Score | None = None
    asset_criticality: Literal["low", "medium", "critical"]
    frequency_score: Score
    baseline: Baseline | None = None


class RiskPreviewResponse(BaseModel):
    risk_score: float
    severity: Literal["low", "medium", "high", "critical"]
    components: dict[str, float | None]
    baseline_ready: bool
    operational: Literal[False] = False
    model_status: Literal["not_implemented"] = "not_implemented"
    calibration_status: Literal["not_calibrated"] = "not_calibrated"
    warning: str = "Calculation only; caller-provided scores are not verified detections."


def require_internal_token(authorization: Annotated[str | None, Header()] = None) -> None:
    expected = os.getenv("NEXORA_ML_SERVICE_TOKEN", "")
    if len(expected.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="service_token_not_configured")
    parts = (authorization or "").split()
    supplied = parts[1] if len(parts) == 2 and parts[0].lower() == "bearer" else ""
    if not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(status_code=401, detail="unauthorized")


@app.get("/health/live")
def live() -> dict[str, str]:
    return {"status": "live"}


@app.get("/health/ready")
def ready() -> dict[str, str]:
    if len(os.getenv("NEXORA_ML_SERVICE_TOKEN", "").encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="service_token_not_configured")
    return {"status": "ready", "model_status": "not_implemented", "mode": "preview_only"}


@app.post("/internal/v1/risk-preview", response_model=RiskPreviewResponse, dependencies=[Depends(require_internal_token)])
def risk_preview(value: RiskPreviewRequest) -> RiskPreviewResponse:
    now = datetime.now(timezone.utc)
    baseline_ready = False
    if value.baseline is not None:
        if value.baseline.started_at > now:
            raise HTTPException(status_code=422, detail="baseline_start_in_future")
        baseline_ready = (
            now - value.baseline.started_at >= timedelta(days=14)
            or value.baseline.normalized_event_count >= 100_000
        )
    if value.anomaly_score is not None and not baseline_ready:
        raise HTTPException(status_code=409, detail="baseline_not_ready")

    asset = {"low": 0.2, "medium": 0.6, "critical": 1.0}[value.asset_criticality]
    anomaly = value.anomaly_score or 0.0
    score = round(min(1.0, 0.45 * value.rule_score + 0.35 * anomaly + 0.12 * asset + 0.08 * value.frequency_score), 6)
    severity: Literal["low", "medium", "high", "critical"] = (
        "low" if score <= 0.30 else "medium" if score <= 0.55 else "high" if score <= 0.80 else "critical"
    )
    return RiskPreviewResponse(
        risk_score=score,
        severity=severity,
        components={"rule_score": value.rule_score, "anomaly_score": value.anomaly_score, "asset_score": asset, "frequency_score": value.frequency_score},
        baseline_ready=baseline_ready,
    )
