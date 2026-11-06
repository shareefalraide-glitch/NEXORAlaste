#!/usr/bin/env python3
"""Validate the OpenAPI documents and the executable route inventory.

Install tools/requirements-contracts.txt first. This checks the inventory,
not full request/response conformance or implementation of planned endpoints.
"""
import json
import re
from pathlib import Path

try:
    from openapi_spec_validator import validate
except ImportError as exc:
    raise SystemExit("Install tools/requirements-contracts.txt to validate OpenAPI") from exc

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"


def read(name):
    with (CONTRACTS / name).open(encoding="utf-8") as stream:
        value = json.load(stream)
    validate(value)
    return value


def operations(spec):
    return {(method.upper(), path) for path, path_item in spec["paths"].items() for method in path_item if method in {"get", "post", "put", "patch", "delete"}}


implemented = read("openapi.json")
planned = read("planned.openapi.json")
ml = read("ml-preview.openapi.json")
source = (ROOT / "services/api/internal/api/server.go").read_text(encoding="utf-8")
routes = set()
for receiver, method, path in re.findall(r'\b(app|v)\.(Get|Post|Put|Patch|Delete)\("([^"]+)"', source):
    prefix = "/api/v1" if receiver == "v" else ""
    path = re.sub(r"/:([A-Za-z_][A-Za-z0-9_]*)", r"/{\1}", path)
    routes.add((method.upper(), prefix + path))
contract_routes = operations(implemented)
if routes != contract_routes:
    raise SystemExit(f"Route inventory mismatch. Undocumented: {routes - contract_routes}; not implemented: {contract_routes - routes}")
if operations(implemented) & operations(planned):
    raise SystemExit("An operation cannot be both implemented and planned")
for name, spec, expected in (("implemented", implemented, "implemented"), ("planned", planned, "planned"), ("ml-preview", ml, "implemented-preview")):
    ids = []
    for path, path_item in spec["paths"].items():
        for method, operation in path_item.items():
            if method not in {"get", "post", "put", "patch", "delete"}:
                continue
            if operation.get("x-implementation-status") != expected:
                raise SystemExit(f"Incorrect status: {name} {method} {path}")
            ids.append(operation["operationId"])
    if len(ids) != len(set(ids)):
        raise SystemExit(f"Duplicate operationId in {name}")
    print(f"PASS {name}: {len(ids)} OpenAPI operations")
with (CONTRACTS / "schemas/normalized-event.v1.schema.json").open(encoding="utf-8") as f:
    schema = json.load(f)
source_event = implemented["components"]["schemas"]["EventInput"]
if schema["properties"] != source_event["properties"] or schema["required"] != source_event["required"]:
    raise SystemExit("Normalized event schema diverges from the implemented API")
print("PASS implemented route inventory and normalized-event schema; planned routes remain unimplemented")
