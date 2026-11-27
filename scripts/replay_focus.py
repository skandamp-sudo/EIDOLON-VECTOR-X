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
    if not isinstance(expected, dict) or expected.get("protocol") not in {"focus-retrieval-v1","ascension-retrieval-v1"}:
        raise ValueError("Expected a supported retrieval report.")
    body = json.dumps(expected["replay"], ensure_ascii=False, separators=(",", ":")).encode()
    conn = http.client.HTTPConnection("127.0.0.1", 8000, timeout=90)
    try:
        endpoint = "/api/v1/research-v2/debug" if expected["protocol"] == "ascension-retrieval-v1" else "/api/v1/intelligence/debug"
        conn.request("POST", endpoint, body,
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
    # Research exports retain the server's binary64 values and numeric types.
    # Canonical JSON also distinguishes signed zero, unlike dictionary equality.
    if expected.get("reduction_policy"):
        equal = json.dumps(actual, sort_keys=True, allow_nan=False) == json.dumps(expected, sort_keys=True, allow_nan=False)
    else:
        equal = actual == expected
    if not equal:
        raise ValueError("Replay mismatch. Preserve both the original report and model identity.")
    print(f"Exact report replay matched · {len(actual['tasks'])} tasks · gate {actual['gate']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("report", type=Path)
    try:
        replay(parser.parse_args().report)
    except (OSError, ValueError, KeyError, TypeError, RecursionError, http.client.HTTPException) as exc:
        parser.exit(1, f"{exc}\n")
