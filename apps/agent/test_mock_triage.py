#!/usr/bin/env python3
"""
Test script to run the SRE agent against the mock-triage Datadog environment.

This simulates a real incident investigation using data from:
- The local OrbStack Kubernetes cluster
- Chaos Mesh experiments (network delay, CPU stress, pod failures)
- Load test traffic generating metrics and logs

Usage:
    cd "/Users/liambush/scout v3/apps/agent"
    uv run python test_mock_triage.py
"""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

from src.graph import run_investigation


async def main():
    # Datadog credentials from .env
    datadog_creds = {
        "api_key": os.getenv("DD_API_KEY"),
        "app_key": os.getenv("DD_APP_KEY"),
        "site": os.getenv("DD_SITE", "us5.datadoghq.com"),
    }

    # Simulated alert context - mimics what a real Datadog webhook would send
    # This represents an alert from your mock-triage environment
    alert_context = {
        "alert_name": "[TEST] High Latency - storedog-frontend P95 > 500ms",
        "service": "storedog-frontend",
        "severity": "P2",
        "message": """
Monitor triggered: High latency detected on storedog-frontend service.

Current P95 latency: 650ms (threshold: 500ms)
Affected hosts: orbstack
Environment: test
Cluster: local-dev-cluster

The service is experiencing elevated response times.
Network chaos experiment (500ms delay) may be active.
Recent pod restarts detected in the storedog namespace.
        """,
        "monitor_id": 12345,  # Placeholder - you can create a real monitor
        "tags": ["env:test", "service:storedog-frontend", "cluster:local-dev-cluster"],
    }

    print("=" * 60)
    print("SRE AGENT - MOCK TRIAGE INVESTIGATION")
    print("=" * 60)
    print(f"\nAlert: {alert_context['alert_name']}")
    print(f"Service: {alert_context['service']}")
    print(f"Severity: {alert_context['severity']}")
    print(f"\nDatadog Site: {datadog_creds['site']}")
    print("=" * 60)
    print("\nStarting investigation...\n")

    result = await run_investigation(
        investigation_id="test-001",
        org_id="mock-triage",
        alert_context=alert_context,
        datadog_creds=datadog_creds,
        github_creds=None,  # No GitHub for this test
        slack_creds=None,   # No Slack for this test
    )

    print("\n" + "=" * 60)
    print("INVESTIGATION COMPLETE")
    print("=" * 60)
    print(f"\nSuccess: {result.get('success')}")
    print(f"Duration: {result.get('duration_ms')}ms")

    if result.get('error'):
        print(f"\nError: {result.get('error')}")
    else:
        print(f"\nSummary:\n{result.get('summary', 'No summary')}")


if __name__ == "__main__":
    asyncio.run(main())
