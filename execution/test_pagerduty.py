"""
PagerDuty Events API v2 — Integration Key Validator
Sends a test trigger event to validate the PAGERDUTY_API_KEY.

Usage:
    python execution/test_pagerduty.py

Expected: 202 Accepted with dedup_key in response.
"""

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

# Load from .env if not in environment
def load_env():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    os.environ.setdefault(key.strip(), value.strip())

def main():
    load_env()

    api_key = os.environ.get("PAGERDUTY_ROUTING_KEY")
    if not api_key:
        print("ERROR: PAGERDUTY_ROUTING_KEY not found in environment or .env file")
        sys.exit(1)

    print(f"Using PagerDuty routing key: {api_key[:8]}...")

    payload = {
        "routing_key": api_key,
        "event_action": "trigger",
        "dedup_key": "antigravity-test-event-001",
        "payload": {
            "summary": "[TEST] Antigravity Ledger Tamper Detection — Validation Event",
            "severity": "critical",
            "source": "antigravity-audit-trigger",
            "component": "audit_logs",
            "group": "database-integrity",
            "class": "ledger_tamper_detection",
            "custom_details": {
                "test": True,
                "platform": "Antigravity Healthcare Grievance Platform",
                "trigger_source": "Task 1.0 Infrastructure Validation",
                "timestamp": "2026-03-03T22:40:00+05:30"
            }
        }
    }

    url = "https://events.pagerduty.com/v2/enqueue"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = json.loads(response.read().decode("utf-8"))

            if status == 202:
                print(f"SUCCESS: PagerDuty accepted the event (HTTP {status})")
                print(f"  Status:    {body.get('status')}")
                print(f"  Message:   {body.get('message')}")
                print(f"  Dedup Key: {body.get('dedup_key')}")
                print("\nPagerDuty integration is VALID. Check your PagerDuty dashboard for the test incident.")
                print("Remember to RESOLVE the test incident after verification.")
            else:
                print(f"WARNING: Unexpected HTTP {status}")
                print(f"  Response: {body}")

    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"ERROR: PagerDuty returned HTTP {e.code}")
        print(f"  Response: {error_body}")
        if e.code == 400:
            print("  This usually means the routing key format is invalid.")
        elif e.code == 429:
            print("  Rate limited — try again in a moment.")
        sys.exit(1)

    except urllib.error.URLError as e:
        print(f"ERROR: Could not reach PagerDuty API: {e.reason}")
        sys.exit(1)


if __name__ == "__main__":
    main()
