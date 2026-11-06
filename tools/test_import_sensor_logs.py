"""Synthetic regression tests for the offline Suricata/Zeek adapter."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("import_sensor_logs", ROOT / "tools/import_sensor_logs.py")
assert SPEC and SPEC.loader
adapter = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(adapter)


class SensorLogImportTests(unittest.TestCase):
    def test_suricata_eve_json_maps_alert_with_addresses(self):
        raw = json.dumps({
            "timestamp": "2026-11-05T10:11:12.123456+03:00", "event_type": "alert",
            "src_ip": "192.0.2.10", "dest_ip": "2001:db8::2",
            "alert": {"signature": "ET TEST synthetic signature"},
        }, separators=(",", ":"))
        out = adapter.parse_text(raw, "suricata-eve")[0]
        self.assertEqual(out["action"], "alert")
        self.assertEqual(out["category"], "network")
        self.assertEqual(out["original_timestamp"], "2026-11-05T07:11:12.123456Z")
        self.assertEqual(out["source_ip"], "192.0.2.10")
        self.assertEqual(out["destination_ip"], "2001:db8::2")
        self.assertIn("ET TEST", out["message"])
        self.assertEqual(out["source_sequence"], adapter.parse_text(raw, "suricata-eve")[0]["source_sequence"])

    def test_zeek_json_epoch_and_connection_fields(self):
        raw = '{"ts":1793872800.5,"_path":"conn","id.orig_h":"198.51.100.4","id.resp_h":"203.0.113.8","service":"https"}'
        out = adapter.parse_text(raw, "zeek-json")[0]
        self.assertEqual(out["action"], "conn")
        self.assertEqual(out["source_ip"], "198.51.100.4")
        self.assertEqual(out["message"], "https")
        self.assertTrue(out["original_timestamp"].endswith("Z"))

    def test_zeek_tsv_header_and_fields(self):
        sample = (
            "#separator \\x09\n"
            "#fields\tts\tuid\tid.orig_h\tid.resp_h\tservice\n"
            "#types\ttime\tstring\taddr\taddr\tstring\n"
            "1793872800.25\tC1\t192.0.2.2\t198.51.100.9\tdns\n"
        )
        out = adapter.parse_text(sample, "zeek-tsv")[0]
        self.assertEqual(out["source_ip"], "192.0.2.2")
        self.assertEqual(out["destination_ip"], "198.51.100.9")
        self.assertEqual(out["message"], "dns")

    def test_rejects_bad_timestamp_ip_json_and_oversized_batch(self):
        with self.assertRaises(adapter.ImportErrorDetail):
            adapter.parse_text('{"timestamp":"2026-11-05T10:00:00","event_type":"flow"}', "suricata-eve")
        with self.assertRaises(adapter.ImportErrorDetail):
            adapter.parse_text('{"timestamp":"2026-11-05T10:00:00Z","event_type":"flow","src_ip":"not-ip"}', "suricata-eve")
        with self.assertRaises(adapter.ImportErrorDetail):
            adapter.parse_text('{broken', "suricata-eve")
        with self.assertRaises(adapter.ImportErrorDetail):
            adapter.parse_text("{" + "\\\"x\\\":" * 1100 + "0" + "}" * 1100, "zeek-json")
        records = "\n".join(json.dumps({"timestamp":"2026-11-05T10:00:00Z", "event_type":"flow"}) for _ in range(101))
        with self.assertRaisesRegex(adapter.ImportErrorDetail, "maximum per API batch"):
            adapter.parse_text(records, "suricata-eve")

    def test_cli_emits_ready_to_post_batch(self):
        source = ROOT / "docs/examples/suricata-eve.synthetic.jsonl"
        result = subprocess.run(
            [sys.executable, str(ROOT / "tools/import_sensor_logs.py"), "suricata-eve", str(source)],
            capture_output=True, text=True, check=True,
        )
        payload = json.loads(result.stdout)
        self.assertEqual(len(payload["events"]), 2)
        self.assertEqual(payload["events"][0]["action"], "alert")


if __name__ == "__main__":
    unittest.main()
