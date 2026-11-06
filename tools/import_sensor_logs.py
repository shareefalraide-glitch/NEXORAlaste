#!/usr/bin/env python3
"""Convert bounded Suricata EVE or Zeek logs to NEXORA's normalized event batch.

This is an offline file adapter, not a network collector, rule engine, or detector.
It emits at most 100 events to match POST /internal/v1/event-batches.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import ipaddress
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable

MAX_FILE_BYTES = 900_000
MAX_EVENTS = 100
MAX_MESSAGE = 4096


class ImportErrorDetail(ValueError):
    """Input is malformed or outside the documented import limits."""


def _timestamp(value: Any, line: int, *, numeric_epoch: bool = False) -> str:
    try:
        if numeric_epoch:
            if isinstance(value, bool) or not isinstance(value, (str, int, float)):
                raise ValueError
            epoch = float(value)
            if not math.isfinite(epoch):
                raise ValueError
            parsed = dt.datetime.fromtimestamp(epoch, tz=dt.timezone.utc)
        else:
            if not isinstance(value, str) or len(value) > 64:
                raise ValueError
            normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
            parsed = dt.datetime.fromisoformat(normalized)
            if parsed.tzinfo is None or parsed.utcoffset() is None:
                raise ValueError
            parsed = parsed.astimezone(dt.timezone.utc)
    except (ValueError, TypeError, OverflowError, OSError):
        raise ImportErrorDetail(f"line {line}: invalid or timezone-naive timestamp") from None
    return parsed.isoformat(timespec="microseconds").replace("+00:00", "Z")


def _ip(value: Any, line: int, field: str) -> str | None:
    if value in (None, "", "-", "(empty)"):
        return None
    if not isinstance(value, str):
        raise ImportErrorDetail(f"line {line}: {field} must be an IP address")
    try:
        return str(ipaddress.ip_address(value))
    except ValueError:
        raise ImportErrorDetail(f"line {line}: invalid {field}") from None


def _text(value: Any, line: int, field: str, limit: int) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = str(value)
    value = value.strip()
    if len(value) > limit:
        raise ImportErrorDetail(f"line {line}: {field} exceeds {limit} characters")
    return value


def _sequence(raw: str, line: int) -> str:
    # Stable across runs and machines so re-imports are idempotent at the API.
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]
    return f"import:{line}:{digest}"


def _event(raw: str, line: int, timestamp: Any, category: str, action: str,
           src: Any = None, dst: Any = None, message: Any = "", *, epoch=False) -> dict[str, str]:
    event = {
        "source_sequence": _sequence(raw, line),
        "original_timestamp": _timestamp(timestamp, line, numeric_epoch=epoch),
        "category": _text(category, line, "category", 100),
        "action": _text(action, line, "action", 100),
    }
    source_ip = _ip(src, line, "source_ip")
    destination_ip = _ip(dst, line, "destination_ip")
    if source_ip:
        event["source_ip"] = source_ip
    if destination_ip:
        event["destination_ip"] = destination_ip
    message = _text(message, line, "message", MAX_MESSAGE)
    if message:
        event["message"] = message
    return event


def _suricata_record(raw: str, line: int) -> dict[str, str]:
    try:
        record = json.loads(raw)
    except (json.JSONDecodeError, RecursionError) as exc:
        detail = exc.msg if isinstance(exc, json.JSONDecodeError) else "nesting is too deep"
        raise ImportErrorDetail(f"line {line}: invalid JSON ({detail})") from None
    if not isinstance(record, dict):
        raise ImportErrorDetail(f"line {line}: record must be a JSON object")
    event_type = record.get("event_type")
    if not isinstance(event_type, str) or not event_type.strip():
        raise ImportErrorDetail(f"line {line}: event_type is required")
    alert = record.get("alert") if isinstance(record.get("alert"), dict) else {}
    message = alert.get("signature") or record.get("dns", {}).get("rrname") if isinstance(record.get("dns"), dict) else alert.get("signature")
    if not message:
        message = record.get("http", {}).get("url", "") if isinstance(record.get("http"), dict) else ""
    return _event(raw, line, record.get("timestamp"), "network", event_type,
                  record.get("src_ip"), record.get("dest_ip"), message)


def _zeek_record(record: dict[str, Any], raw: str, line: int) -> dict[str, str]:
    timestamp = record.get("ts")
    category = "network"
    action = _text(record.get("_path") or record.get("path") or "zeek", line, "action", 100)
    src, dst = record.get("id.orig_h"), record.get("id.resp_h")
    message = record.get("note") or record.get("msg") or record.get("query") or record.get("service") or record.get("conn_state") or ""
    return _event(raw, line, timestamp, category, action, src, dst, message, epoch=True)


def _zeek_tsv(lines: list[str]) -> list[tuple[int, str, dict[str, str]]]:
    separator = "\t"
    fields: list[str] | None = None
    records: list[tuple[int, str, dict[str, str]]] = []
    for line_no, raw in enumerate(lines, 1):
        line = raw.rstrip("\r\n")
        if not line:
            continue
        if line.startswith("#separator "):
            token = line[len("#separator "):]
            escapes = {r"\x09": "\t", r"\x20": " ", r"\x7c": "|", r"\x2c": ","}
            if token not in escapes:
                raise ImportErrorDetail(f"line {line_no}: unsupported Zeek separator")
            separator = escapes[token]
            continue
        if line.startswith("#fields"):
            fields = line.split(separator)[1:]
            if not fields or "ts" not in fields:
                raise ImportErrorDetail(f"line {line_no}: Zeek #fields must include ts")
            continue
        if line.startswith("#"):
            continue
        if fields is None:
            raise ImportErrorDetail(f"line {line_no}: Zeek TSV requires a #fields header")
        values = line.split(separator)
        if len(values) != len(fields):
            raise ImportErrorDetail(f"line {line_no}: field count does not match #fields")
        record = {key: value for key, value in zip(fields, values)}
        # Preserve original content for deterministic import sequence.
        records.append((line_no, raw.rstrip("\r\n"), record))
    return records


def parse_text(text: str, format_name: str) -> list[dict[str, str]]:
    """Parse a complete UTF-8 file; reject malformed records rather than silently skip."""
    if format_name not in ("suricata-eve", "zeek-json", "zeek-tsv"):
        raise ImportErrorDetail("format must be suricata-eve, zeek-json, or zeek-tsv")
    lines = text.splitlines()
    events: list[dict[str, str]] = []
    if format_name == "zeek-tsv":
        records = _zeek_tsv(lines)
        for line, raw, value in records:
            events.append(_zeek_record(value, raw, line))
    else:
        for line, raw in enumerate(lines, 1):
            if not raw.strip():
                continue
            if format_name == "suricata-eve":
                events.append(_suricata_record(raw, line))
            else:
                try:
                    value = json.loads(raw)
                except (json.JSONDecodeError, RecursionError) as exc:
                    detail = exc.msg if isinstance(exc, json.JSONDecodeError) else "nesting is too deep"
                    raise ImportErrorDetail(f"line {line}: invalid JSON ({detail})") from None
                if not isinstance(value, dict):
                    raise ImportErrorDetail(f"line {line}: record must be a JSON object")
                events.append(_zeek_record(value, raw, line))
    if not events:
        raise ImportErrorDetail("input contains no event records")
    if len(events) > MAX_EVENTS:
        raise ImportErrorDetail(f"input has {len(events)} events; maximum per API batch is {MAX_EVENTS}")
    return events


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("format", choices=("suricata-eve", "zeek-json", "zeek-tsv"))
    parser.add_argument("input", type=Path, help="local log file; '-' reads standard input")
    parser.add_argument("-o", "--output", type=Path, help="write batch JSON to this file (default stdout)")
    args = parser.parse_args(argv)
    try:
        if str(args.input) == "-":
            data = sys.stdin.buffer.read(MAX_FILE_BYTES + 1)
        else:
            if args.input.stat().st_size > MAX_FILE_BYTES:
                raise ImportErrorDetail(f"file exceeds {MAX_FILE_BYTES} bytes")
            data = args.input.read_bytes()
        if len(data) > MAX_FILE_BYTES:
            raise ImportErrorDetail(f"input exceeds {MAX_FILE_BYTES} bytes")
        text = data.decode("utf-8")
        batch = {"events": parse_text(text, args.format)}
        rendered = json.dumps(batch, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            args.output.write_text(rendered, encoding="utf-8")
        else:
            sys.stdout.write(rendered)
    except (OSError, UnicodeDecodeError, ImportErrorDetail) as exc:
        print(f"import error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
