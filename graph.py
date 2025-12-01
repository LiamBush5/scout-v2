
# src/lib/agent/graph.py
"""
LangGraph SRE Investigation Agent

First Principles:
================
1. Most incidents (70-80%) are caused by recent CHANGES
2. Expert SREs think in HYPOTHESES and test them systematically
3. Time is critical - first 5 minutes determine MTTR
4. Output must be ACTIONABLE, not just descriptive

Architecture:
============
TRIAGE → CHANGE DETECTION → HYPOTHESIS TESTING → CONCLUSION
         ↑
         Highest-yield step (always check deployments first)
"""

from typing import TypedDict, Literal, Annotated, Sequence
from datetime import datetime
import json

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langchain_anthropic import ChatAnthropic
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode
from langgraph.graph.message import add_messages
from langsmith import traceable


# =============================================================================
# CONFIGURATION
# =============================================================================

MAX_ITERATIONS = 15
MODEL_NAME = "claude-sonnet-4-20250514"
MODEL_MAX_TOKENS = 4096
MODEL_TEMPERATURE = 0


# =============================================================================
# STATE
# =============================================================================

class AgentState(TypedDict):
    """Investigation state that flows through the graph."""
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # Identity
    investigation_id: str
    org_id: str
    alert_context: dict

    # Credentials
    datadog_creds: dict | None
    github_creds: dict | None
    slack_creds: dict | None

    # Progress
    phase: str  # triage | changes | hypothesis | conclusion
    iteration: int
    max_iterations: int

    # Accumulated knowledge
    recent_deployments: list[dict]
    affected_services: list[str]

    # Timing
    started_at: str


# =============================================================================
# SYSTEM PROMPT
# =============================================================================

SYSTEM_PROMPT = """You are an expert Site Reliability Engineer investigating a production incident. Your goal: identify the root cause and provide actionable recommendations within 5 minutes.

## Investigation Methodology

### Phase 1: TRIAGE (30 seconds)
- What is the alert telling us?
- Is this real or a false positive?
- What service is affected?

### Phase 2: CHANGE DETECTION (HIGHEST PRIORITY - 60 seconds)
MOST INCIDENTS ARE CAUSED BY CHANGES. Always check:
- Recent deployments (last 4 hours)
- Configuration changes
- Infrastructure changes

If a deployment occurred 5-60 minutes before the incident, IT IS THE PRIME SUSPECT.

### Phase 3: HYPOTHESIS TESTING (2-3 minutes)
Test the most likely hypotheses:
1. Recent deployment introduced a bug (most common)
2. Downstream dependency failure
3. Resource exhaustion
4. Traffic spike

### Phase 4: CONCLUSION
- State the most likely root cause (with confidence: High/Medium/Low)
- Provide specific evidence
- Give prioritized action items
- Send results to Slack

## Critical Rules

1. **CHECK DEPLOYMENTS FIRST** - Highest signal investigation step
2. **BE SPECIFIC** - Cite exact values, timestamps, commands
3. **SHOW EVIDENCE** - Every claim backed by data
4. **ACTIONABLE OUTPUT** - Tell them what to DO

## Tool Usage

TRIAGE:
- get_monitor_details → Understand the alert
- get_apm_service_summary → Service health overview

CHANGE DETECTION (DO THIS EARLY):
- get_recent_deployments → Find code changes
- get_datadog_events → Find config/infra changes

INVESTIGATION:
- query_metrics → Test specific hypotheses
- search_logs → Find error messages

CONCLUSION:
- send_investigation_result → Report to Slack"""


# =============================================================================
# GRAPH CONSTRUCTION
# =============================================================================

def create_investigation_graph(
    datadog_creds: dict | None = None,
    github_creds: dict | None = None,
    slack_creds: dict | None = None,
):
    """Create the investigation graph with configured tools."""

    # Initialize LLM
    llm = ChatAnthropic(
        model=MODEL_NAME,
        max_tokens=MODEL_MAX_TOKENS,
        temperature=MODEL_TEMPERATURE,
    )

    # Create tools
    tools = []

    if datadog_creds:
        from .tools.datadog_tools import create_datadog_tools
        tools.extend(create_datadog_tools(datadog_creds))

    if github_creds:
        from .tools.github_tools import create_github_tools
        tools.extend(create_github_tools(github_creds))

    if slack_creds:
        from .tools.slack_tools import create_slack_tools
        tools.extend(create_slack_tools(slack_creds))

    llm_with_tools = llm.bind_tools(tools) if tools else llm
    tool_node = ToolNode(tools) if tools else None

    # -------------------------------------------------------------------------
    # AGENT NODE
    # -------------------------------------------------------------------------

    def agent_node(state: AgentState) -> dict:
        """Main agent reasoning node."""
        phase = state.get("phase", "triage")
        iteration = state.get("iteration", 0)
        max_iter = state.get("max_iterations", MAX_ITERATIONS)
        alert = state.get("alert_context", {})
        deployments = state.get("recent_deployments", [])

        # Build context
        context = f"""## Investigation Status
- Phase: {phase.upper()}
- Iteration: {iteration}/{max_iter}

## Alert Context
- Alert: {alert.get('alert_name', 'Unknown')}
- Service: {alert.get('service', 'Unknown')}
- Severity: {alert.get('severity', 'Unknown')}
- Message: {str(alert.get('message', ''))[:300]}"""

        if deployments:
            deploy_list = "\n".join([
                f"- {d.get('sha', '?')[:7]} at {d.get('created_at', '?')} ({d.get('minutes_ago', '?')} min ago)"
                for d in deployments[:5]
            ])
            context += f"\n\n## Recent Deployments Found\n{deploy_list}"

        # Phase guidance
        phase_prompts = {
            "triage": "\n\n## Goal: TRIAGE\nUnderstand the alert. Get monitor details and verify the issue is real.",
            "changes": "\n\n## Goal: CHANGE DETECTION\nFind what changed. Get recent deployments and Datadog events.",
            "hypothesis": "\n\n## Goal: HYPOTHESIS TESTING\nTest likely causes. Query metrics and logs for evidence.",
            "conclusion": "\n\n## Goal: CONCLUDE\nSynthesize findings. Send results to Slack with send_investigation_result.",
        }
        context += phase_prompts.get(phase, "")

        if iteration >= max_iter - 3:
            context += f"\n\n⚠️ Iteration limit approaching ({iteration}/{max_iter}). Conclude soon."

        # Build messages
        messages = [SystemMessage(content=SYSTEM_PROMPT)]

        if iteration == 0:
            messages.append(HumanMessage(content=f"""A Datadog alert has fired. Begin investigation.

**Alert**: {alert.get('alert_name', 'Unknown')}
**Service**: {alert.get('service', 'Unknown')}
**Severity**: {alert.get('severity', 'Unknown')}
**Message**: {str(alert.get('message', ''))[:500]}

Start with triage, then check for recent deployments."""))
        else:
            messages.append(HumanMessage(content=context))

        messages.extend(list(state.get("messages", [])))

        # Get response
        response = llm_with_tools.invoke(messages)

        # Phase transitions based on iteration
        new_phase = phase
        if phase == "triage" and iteration >= 2:
            new_phase = "changes"
        elif phase == "changes" and iteration >= 5:
            new_phase = "hypothesis"
        elif phase == "hypothesis" and iteration >= 10:
            new_phase = "conclusion"

        return {
            "messages": [response],
            "iteration": iteration + 1,
            "phase": new_phase,
        }

    # -------------------------------------------------------------------------
    # TOOLS NODE
    # -------------------------------------------------------------------------

    def tools_node(state: AgentState) -> dict:
        """Execute tool calls."""
        if tool_node is None:
            return {"messages": []}

        result = tool_node.invoke(state)

        # Extract deployment info from results
        new_deployments = list(state.get("recent_deployments", []))

        for msg in result.get("messages", []):
            if hasattr(msg, "content"):
                try:
                    content = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                    if isinstance(content, dict) and "deployments" in content:
                        for d in content["deployments"]:
                            if d not in new_deployments:
                                new_deployments.append(d)
                except:
                    pass

        return {
            "messages": result.get("messages", []),
            "recent_deployments": new_deployments[:20],
        }

    # -------------------------------------------------------------------------
    # ROUTING
    # -------------------------------------------------------------------------

    def should_continue(state: AgentState) -> Literal["tools", "end"]:
        """Decide whether to continue or end."""
        messages = state.get("messages", [])
        iteration = state.get("iteration", 0)
        max_iter = state.get("max_iterations", MAX_ITERATIONS)

        if iteration >= max_iter:
            return "end"

        if messages:
            last = messages[-1]
            if isinstance(last, AIMessage) and last.tool_calls:
                return "tools"

        if state.get("phase") == "conclusion":
            return "end"

        return "end"

    # -------------------------------------------------------------------------
    # BUILD GRAPH
    # -------------------------------------------------------------------------

    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tools_node)
    graph.add_edge(START, "agent")
    graph.add_conditional_edges("agent", should_continue, {"tools": "tools", "end": END})
    graph.add_edge("tools", "agent")

    return graph.compile()


# =============================================================================
# ENTRY POINTS
# =============================================================================

@traceable(name="run_investigation", run_type="chain")
async def run_investigation(
    investigation_id: str,
    org_id: str,
    alert_context: dict,
    datadog_creds: dict | None = None,
    github_creds: dict | None = None,
    slack_creds: dict | None = None,
) -> dict:
    """
    Run a complete investigation.

    Args:
        investigation_id: Unique ID for this investigation
        org_id: Organization ID for multi-tenancy
        alert_context: Dict with alert_name, service, severity, message
        datadog_creds: Dict with api_key, app_key, site
        github_creds: Dict with app_id, private_key, installation_id
        slack_creds: Dict with bot_token, channel_id

    Returns:
        Dict with summary, deployments_found, tool_calls, duration_ms
    """
    start_time = datetime.utcnow()

    graph = create_investigation_graph(
        datadog_creds=datadog_creds,
        github_creds=github_creds,
        slack_creds=slack_creds,
    )

    initial_state: AgentState = {
        "messages": [],
        "investigation_id": investigation_id,
        "org_id": org_id,
        "alert_context": alert_context,
        "datadog_creds": datadog_creds,
        "github_creds": github_creds,
        "slack_creds": slack_creds,
        "phase": "triage",
        "iteration": 0,
        "max_iterations": MAX_ITERATIONS,
        "recent_deployments": [],
        "affected_services": [alert_context.get("service")] if alert_context.get("service") else [],
        "started_at": start_time.isoformat(),
    }

    try:
        final_state = await graph.ainvoke(initial_state)
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "duration_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
        }

    # Extract summary
    messages = final_state.get("messages", [])
    summary = "Investigation complete."

    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and not msg.tool_calls:
            if isinstance(msg.content, str) and len(msg.content) > 50:
                summary = msg.content
                break

    return {
        "success": True,
        "summary": summary,
        "deployments_found": final_state.get("recent_deployments", []),
        "tool_calls": final_state.get("iteration", 0),
        "final_phase": final_state.get("phase"),
        "duration_ms": int((datetime.utcnow() - start_time).total_seconds() * 1000),
    }


def run_investigation_sync(
    investigation_id: str,
    org_id: str,
    alert_context: dict,
    datadog_creds: dict | None = None,
    github_creds: dict | None = None,
    slack_creds: dict | None = None,
) -> dict:
    """Synchronous wrapper for run_investigation."""
    import asyncio
    return asyncio.run(run_investigation(
        investigation_id, org_id, alert_context,
        datadog_creds, github_creds, slack_creds
    ))
