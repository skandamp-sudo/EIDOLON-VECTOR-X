"""Replay a locally exported FOCUS report against the loopback service and compare all measurements."""
import argparse
import http.client
import json
from pathlib import Path

MAX_REPORT_BYTES = 12_000_000


def replay(path):
    with path.open("rb") as f:
        raw = f.read(MAX_REPORT_BYTES + 1)
    if len(raw) > MAX_REPORT_BYTES:
        raise ValueError("Report exceeds 12 MB.")
    expected = json.loads(raw)
    if not isinstance(expected, dict) or expected.get("protocol") != "focus-retrieval-v1":
        raise ValueError("Expected a FOCUS v1 report.")
    body = json.dumps(expected["replay"], ensure_ascii=False, separators=(",", ":")).encode()
    conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=30)
    try:
        conn.request("POST", "/api/v1/intelligence/debug", body,
                     {"Content-Type": "application/json", "X-Vector-X-Client": "foundry"})
        response = conn.getresponse()
        if response.status != 200:
            raise ValueError(f"Local service rejected this replay (HTTP {response.status}).")
        raw = response.read(MAX_REPORT_BYTES + 1)
        if len(raw) > MAX_REPORT_BYTES:
            raise ValueError("Oversized replay response.")
        actual = json.loads(raw)
    finally:
        conn.close()
    expected.pop("source", None)  # The client records original file/mapping provenance separately.
    if actual != expected:
        raise ValueError("Replay mismatch. Preserve both the original report and model identity.")
    print(f"Exact report replay matched · {len(actual['tasks'])} tasks · gate {actual['gate']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    try:
        replay(parser.parse_args().report)
    except (OSError, ValueError, KeyError, TypeError, RecursionError, http.client.HTTPException) as exc:
        parser.exit(1, f"{exc}\n")
