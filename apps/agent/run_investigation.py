#!/usr/bin/env python3
"""
Run an investigation through the LangGraph server.
"""

import asyncio
from langgraph_sdk import get_client

# Your organization ID from Supabase
ORG_ID = "536462dc-3798-48a4-98b5-45a239bc733a"

async def main():
    client = get_client(url="http://127.0.0.1:2024")

    # Create a thread
    thread = await client.threads.create()
    print(f"Created thread: {thread['thread_id']}")
    print(f"Using org_id: {ORG_ID} (credentials from Supabase Vault)")

    # Prepare the investigation message
    message = """A production incident requires investigation.

**Alert**: [TEST] High Latency - storedog-frontend P95 > 500ms
**Service**: storedog-frontend
**Severity**: P2
**Message**: Monitor triggered: High latency detected on storedog-frontend service. Current P95 latency: 650ms (threshold: 500ms). Affected hosts: orbstack. Environment: test. Cluster: local-dev-cluster. The service is experiencing elevated response times. Network chaos experiment (500ms delay) may be active. Recent pod restarts detected in the storedog namespace.

Begin your investigation:
1. Use the Datadog tools to understand the alert and service health
2. Check for recent deployments or changes
3. Identify the root cause
4. Provide actionable recommendations"""

    print("\n" + "=" * 60)
    print("STARTING INVESTIGATION")
    print("=" * 60 + "\n")

    # Stream the response with org_id in config to fetch credentials from Supabase
    async for chunk in client.runs.stream(
        thread_id=thread['thread_id'],
        assistant_id="investigation",
        input={"messages": [{"role": "user", "content": message}]},
        config={"configurable": {"org_id": ORG_ID}},
        stream_mode="messages",
    ):
        if hasattr(chunk, 'data') and chunk.data:
            data = chunk.data
            if isinstance(data, dict):
                # Print tool calls
                if data.get('type') == 'tool_call':
                    print(f"\n🔧 Tool: {data.get('name', 'unknown')}")
                # Print AI messages
                elif data.get('type') == 'ai' and data.get('content'):
                    print(data['content'], end='', flush=True)
            elif isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and item.get('content'):
                        print(item['content'], end='', flush=True)

    print("\n\n" + "=" * 60)
    print("INVESTIGATION COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
