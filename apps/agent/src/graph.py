"""
Deep Agent SRE Investigation System

A cutting-edge agent architecture using deepagents with specialized sub-agents:
- Datadog Sub-Agent: Monitors, metrics, logs, and APM analysis
- GitHub Sub-Agent: Deployment tracking and code change analysis
- Slack Sub-Agent: Team communication and result reporting

Architecture:
============
Main Agent (Orchestrator)
    ├── TodoListMiddleware (planning)
    ├── FilesystemMiddleware (context offloading)
    ├── SubAgentMiddleware
    │   ├── datadog-agent (monitoring specialist)
    │   ├── github-agent (deployment specialist)
    │   └── slack-agent (communication specialist)
    └── SummarizationMiddleware (handles long contexts)
"""

import os
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.prebuilt import create_react_agent

from src.tools.datadog import create_datadog_tools
from src.tools.github import create_github_tools
from src.tools.slack import create_slack_tools
from src.tools.memory import create_memory_tools


# =============================================================================
# CONFIGURATION
# =============================================================================

MODEL_NAME = os.getenv("AGENT_MODEL", "x-ai/grok-4.1-fast:free")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PROMPT = """You are an expert Site Reliability Engineer (SRE) orchestrating incident investigations.

## Your Mission
Identify root causes of production incidents quickly and provide actionable recommendations.

## Investigation Methodology

### Phase 1: TRIAGE + MEMORY CHECK (30 seconds)
- Understand what the alert is telling us
- **IMMEDIATELY check incident memory** - Use search_similar_incidents to see if this has happened before
- If similar past incidents exist, reference what worked (or didn't work) last time
- Verify if this is a real issue or false positive

### Phase 2: CHANGE DETECTION (HIGHEST PRIORITY - 60 seconds)
**MOST INCIDENTS (70-80%) ARE CAUSED BY RECENT CHANGES.**
Always delegate to the github-agent to check:
- Recent deployments (last 4 hours)
- Configuration changes
- Infrastructure changes

If a deployment occurred 5-60 minutes before the incident, IT IS THE PRIME SUSPECT.

### Phase 3: HYPOTHESIS TESTING (2-3 minutes)
Delegate to datadog-agent to test hypotheses:
1. Recent deployment introduced a bug (most common)
2. Downstream dependency failure
3. Resource exhaustion
4. Traffic spike

### Phase 4: CONCLUSION
- Synthesize findings from all sub-agents
- Reference similar past incidents if relevant
- State root cause with confidence level (High/Medium/Low)
- Delegate to slack-agent to report findings

## Sub-Agent Delegation Strategy

You have specialized sub-agents. Use them effectively:

1. **datadog-agent**: For ALL monitoring tasks
   - Get monitor details
   - Query metrics
   - Search logs
   - APM service health

2. **github-agent**: For ALL code/deployment tasks
   - Find recent deployments
   - Analyze commit changes
   - Identify high-risk files

3. **slack-agent**: For ALL communication
   - Send investigation results
   - Post progress updates

## Incident Memory Tools

You have access to incident memory - USE IT:

- **search_similar_incidents**: Find past incidents for the same service/alert
- **get_incident_details**: Get full details of a specific past incident
- **get_service_incident_history**: Understand patterns for a service

When you find similar past incidents:
- Reference the root cause that was identified
- Note if the same fix might apply
- Mention if this is a recurring issue that needs permanent resolution

## Critical Rules

1. **CHECK MEMORY FIRST** - Always search for similar past incidents
2. **DELEGATE DON'T DO** - Use sub-agents for specialized tasks
3. **CHECK DEPLOYMENTS FIRST** - Most incidents are caused by changes
4. **USE TODOS** - Track your investigation progress
5. **BE SPECIFIC** - Cite exact values, timestamps, evidence
6. **LEARN FROM HISTORY** - Reference past incidents in your conclusions
"""


# =============================================================================
# SUB-AGENT DEFINITIONS
# =============================================================================

def create_datadog_subagent(credentials: dict | None = None):
    """Create the Datadog monitoring sub-agent."""
    tools = create_datadog_tools(credentials) if credentials else []

    return {
        "name": "datadog-agent",
        "description": "Specialist for Datadog monitoring: query metrics, search logs, get monitor details, APM analysis. Use for ANY monitoring or observability task.",
        "prompt": """You are a Datadog monitoring specialist. Your job is to:
- Query metrics to test hypotheses
- Search logs for error patterns
- Get monitor details to understand alerts
- Analyze APM data for service health

Always provide INTERPRETED results, not raw data. Highlight anomalies and issues.
When you find something significant, clearly state what it means for the investigation.""",
        "tools": tools,
    }


def create_github_subagent(credentials: dict | None = None):
    """Create the GitHub deployment sub-agent."""
    tools = create_github_tools(credentials) if credentials else []

    return {
        "name": "github-agent",
        "description": "Specialist for GitHub: find recent deployments, analyze code changes, identify risky commits. Use for ANY deployment or code change analysis.",
        "prompt": """You are a GitHub deployment specialist. Your job is to:
- Find recent deployments that might have caused issues
- Analyze what code changed in suspicious commits
- Identify high-risk files (database, config, auth, etc.)

A deployment 5-60 minutes before an incident is the PRIME SUSPECT.
Always calculate how long ago deployments occurred and flag suspicious timing.""",
        "tools": tools,
    }


def create_slack_subagent(credentials: dict | None = None):
    """Create the Slack communication sub-agent."""
    tools = create_slack_tools(credentials) if credentials else []

    return {
        "name": "slack-agent",
        "description": "Specialist for Slack communication: send investigation results, post updates. Use when you need to communicate findings to the team.",
        "prompt": """You are a Slack communication specialist. Your job is to:
- Send well-formatted investigation results
- Post progress updates during long investigations
- Include confidence levels, evidence, and action items

Format messages clearly with:
- Summary at the top
- Root cause with confidence level
- Evidence bullets
- Prioritized action items""",
        "tools": tools,
    }


# =============================================================================
# GRAPH FACTORY
# =============================================================================

def create_investigation_graph(
    config: RunnableConfig | None = None,
    datadog_creds: dict | None = None,
    github_creds: dict | None = None,
    slack_creds: dict | None = None,
    org_id: str | None = None,
):
    """
    Create the investigation graph using LangGraph's create_react_agent.

    This creates a React-style agent with:
    - OpenRouter x-ai/grok-4.1-fast:free model
    - All investigation tools (Datadog, GitHub, Slack)
    - Comprehensive system prompt for SRE investigations

    Credentials can be provided directly or fetched from Supabase Vault using org_id.
    """

    # Initialize model via OpenRouter
    model = ChatOpenAI(
        model=MODEL_NAME,
        temperature=0,
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )

    # If org_id provided, fetch credentials from Supabase Vault
    if org_id and (datadog_creds is None or github_creds is None or slack_creds is None):
        try:
            from src.credentials import get_all_credentials
            vault_creds = get_all_credentials(org_id)
            if datadog_creds is None:
                datadog_creds = vault_creds.get("datadog")
            if github_creds is None:
                github_creds = vault_creds.get("github")
            if slack_creds is None:
                slack_creds = vault_creds.get("slack")
        except Exception as e:
            print(f"Warning: Failed to fetch credentials from vault: {e}")

    # Fallback: Load credentials from environment if not provided
    if datadog_creds is None:
        dd_api_key = os.getenv("DD_API_KEY")
        dd_app_key = os.getenv("DD_APP_KEY")
        dd_site = os.getenv("DD_SITE", "datadoghq.com")
        if dd_api_key and dd_app_key:
            datadog_creds = {
                "api_key": dd_api_key,
                "app_key": dd_app_key,
                "site": dd_site,
            }

    # Collect all tools from sub-agents
    all_tools = []

    # Add Memory tools (incident history) - always available
    memory_tools = create_memory_tools(org_id)
    all_tools.extend(memory_tools)

    # Add Datadog tools
    datadog_tools = create_datadog_tools(datadog_creds) if datadog_creds else create_datadog_tools(None)
    all_tools.extend(datadog_tools)

    # Add GitHub tools
    github_tools = create_github_tools(github_creds) if github_creds else create_github_tools(None)
    all_tools.extend(github_tools)

    # Add Slack tools
    slack_tools = create_slack_tools(slack_creds) if slack_creds else create_slack_tools(None)
    all_tools.extend(slack_tools)

    # Create the React agent with all tools
    agent = create_react_agent(
        model=model,
        tools=all_tools,
        prompt=SYSTEM_PROMPT,
    )

    return agent


# =============================================================================
# LANGGRAPH PLATFORM ENTRY POINT
# =============================================================================

def graph(config: RunnableConfig):
    """Factory function for LangGraph Platform."""
    # Extract org_id from configurable if provided
    configurable = config.get("configurable", {}) if config else {}
    org_id = configurable.get("org_id")

    return create_investigation_graph(config=config, org_id=org_id)


# =============================================================================
# PROGRAMMATIC ENTRY POINTS
# =============================================================================

async def run_investigation(
    investigation_id: str,
    org_id: str,
    alert_context: dict,
    datadog_creds: dict | None = None,
    github_creds: dict | None = None,
    slack_creds: dict | None = None,
) -> dict:
    """
    Run a complete investigation using the deep agent system.

    Args:
        investigation_id: Unique ID for this investigation
        org_id: Organization ID
        alert_context: Dict with alert_name, service, severity, message
        datadog_creds: Dict with api_key, app_key, site
        github_creds: Dict with app_id, private_key, installation_id
        slack_creds: Dict with bot_token, channel_id

    Returns:
        Dict with investigation results
    """
    from datetime import datetime

    start_time = datetime.utcnow()

    # Create the agent with credentials
    agent = create_investigation_graph(
        datadog_creds=datadog_creds,
        github_creds=github_creds,
        slack_creds=slack_creds,
    )

    # Build the initial message
    initial_message = f"""A production incident requires investigation.

**Alert**: {alert_context.get('alert_name', 'Unknown')}
**Service**: {alert_context.get('service', 'Unknown')}
**Severity**: {alert_context.get('severity', 'Unknown')}
**Message**: {str(alert_context.get('message', ''))[:500]}

Begin your investigation:
1. **CHECK MEMORY FIRST** - Use search_similar_incidents to find if this has happened before
2. Plan your investigation steps based on past incidents (if any)
3. Delegate to github-agent to check for recent deployments (HIGHEST PRIORITY)
4. Delegate to datadog-agent to understand the alert and service health
5. Synthesize findings, reference past incidents, and identify root cause
6. Delegate to slack-agent to report results"""

    try:
        result = await agent.ainvoke({
            "messages": [{"role": "user", "content": initial_message}]
        })

        # Extract the final response
        messages = result.get("messages", [])
        summary = "Investigation complete."

        for msg in reversed(messages):
            if hasattr(msg, "content") and isinstance(msg.content, str):
                if len(msg.content) > 50 and not getattr(msg, "tool_calls", None):
                    summary = msg.content
                    break

        return {
            "success": True,
            "summary": summary,
            "duration_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "duration_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
        }
