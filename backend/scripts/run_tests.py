#!/usr/bin/env python3
"""Run spec test cases against a running backend."""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = "http://localhost:8000"
FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "mock_invoice.pdf"


def get(path: str) -> dict:
    with urllib.request.urlopen(f"{BASE}{path}") as resp:
        return json.loads(resp.read())


def post_multipart(path: str, file_path: Path) -> dict:
    boundary = "----ClearBorderV2"
    data = file_path.read_bytes()
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'
        f"Content-Type: application/pdf\r\n\r\n"
    ).encode() + data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read())


def wait_for_state(env_id: str, target: str, timeout: float = 90.0) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        snap = get(f"/api/state/{env_id}")
        if snap["state"] in (target, "EXCEPTION_HOLD", "COMPLETED"):
            return snap
        time.sleep(1.5)
    raise TimeoutError(f"State did not reach {target} within {timeout}s")


def main() -> int:
    print("=== Test 1: verify_state_hydration('env_test_id') ===")
    hydration = get("/api/verify/hydration/env_test_id")
    print(json.dumps(hydration, indent=2))
    if not hydration.get("ok"):
        print("FAIL: hydration")
        return 1
    print("PASS: hydration\n")

    if not FIXTURE.exists():
        print(f"Missing {FIXTURE} — run: python backend/scripts/generate_mock_invoice.py")
        return 1

    print("=== Test 2: POST /api/upload ===")
    try:
        upload = post_multipart("/api/upload", FIXTURE)
    except urllib.error.URLError as exc:
        print(f"FAIL: backend not reachable at {BASE} — {exc}")
        return 1

    print(json.dumps(upload, indent=2))
    env_id = upload["environment_id"]
    print(f"\nWaiting for portal sync ({env_id})…")
    snap = wait_for_state(env_id, "AWAITING_APPROVAL")
    print(f"State: {snap['state']}")
    if snap.get("diff"):
        print(f"Diff: {snap['diff']}")

    if snap["state"] == "AWAITING_APPROVAL":
        approve_req = urllib.request.Request(
            f"{BASE}/api/approve/{env_id}",
            data=b'{"approved": true}',
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(approve_req) as resp:
            approve = json.loads(resp.read())
        print(f"Approve: {approve}")
        final = get(f"/api/state/{env_id}")
        print(f"Final state: {final['state']}")
        if final["state"] != "COMPLETED":
            print("FAIL: expected COMPLETED after approve")
            return 1

    print("\nAll tests passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
