"""
Runbook Tools for the SRE Investigation Agent.

Allows the agent to:
- Find matching runbooks for an alert
- Execute runbook investigation steps
- Apply if_found recommendations
"""

import os
import re
from langchain_core.tools import tool
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Create a Supabase client."""
    url = os.getenv("SUPABASE_URL", "https://zokozwblvsdfldvwflhm.supabase.co")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY required for runbook access")

    return create_client(url, key)


def create_runbook_tools(org_id: str | None = None) -> list:
    """
    Create runbook tools for the agent.

    Args:
        org_id: Organization ID to scope queries to

    Returns:
        List of LangChain tools
    """

    @tool
    def find_matching_runbooks(
        alert_name: str,
        service: str | None = None,
        severity: str | None = None,
    ) -> str:
        """
        Find runbooks that match the current alert.

        Use this at the START of an investigation to see if there's a
        predefined investigation playbook for this type of alert.

        Args:
            alert_name: The name/title of the alert
            service: The service that triggered the alert (optional)
            severity: The severity level (critical, high, medium, low)

        Returns:
            Matching runbooks with their investigation steps and recommendations
        """
        try:
            supabase = get_supabase_client()

            # Get all enabled runbooks for this org
            query = supabase.from_("runbooks").select(
                "id, name, description, trigger_type, trigger_config, "
                "investigation_steps, if_found_actions, priority, "
                "times_triggered, avg_resolution_confidence"
            ).eq("enabled", True)

            if org_id:
                query = query.eq("org_id", org_id)

            query = query.order("priority", desc=False)  # Lower priority = runs first

            result = query.execute()

            if not result.data:
                return "No runbooks configured. Proceed with standard investigation methodology."

            # Find matching runbooks
            matching = []
            for runbook in result.data:
                matches = False
                trigger_type = runbook.get("trigger_type")
                trigger_config = runbook.get("trigger_config", {})

                if trigger_type == "alert_pattern":
                    # Check if alert name matches the pattern
                    pattern = trigger_config.get("pattern", "")
                    if pattern:
                        try:
                            if re.search(pattern, alert_name, re.IGNORECASE):
                                # Also check severity if specified
                                allowed_severities = trigger_config.get("severity", [])
                                if not allowed_severities or (severity and severity.lower() in [s.lower() for s in allowed_severities]):
                                    matches = True
                        except re.error:
                            # Invalid regex, skip
                            pass

                elif trigger_type == "service_alert":
                    # Check if service matches
                    allowed_services = trigger_config.get("services", [])
                    if service and allowed_services:
                        if any(s.lower() in service.lower() for s in allowed_services):
                            matches = True

                # Manual runbooks don't auto-match
                # elif trigger_type == "manual":
                #     pass

                if matches:
                    matching.append(runbook)

            if not matching:
                return f"No runbooks match this alert ('{alert_name}'). Proceed with standard investigation."

            # Format matching runbooks
            output = f"Found {len(matching)} matching runbook(s) for this alert:\n\n"

            for rb in matching:
                steps = rb.get("investigation_steps", [])
                if_found = rb.get("if_found_actions", {})

                steps_str = "\n".join(
                    f"   {i+1}. {step.get('action', 'unknown').replace('_', ' ').title()}"
                    + (f" - {step.get('reason', '')}" if step.get('reason') else "")
                    for i, step in enumerate(steps)
                )

                if_found_str = "\n".join(
                    f"   - If {key.replace('_', ' ')}: {value[:100]}..."
                    if len(value) > 100 else f"   - If {key.replace('_', ' ')}: {value}"
                    for key, value in if_found.items()
                )

                confidence = rb.get("avg_resolution_confidence")
                conf_str = f" | Avg confidence: {int(confidence * 100)}%" if confidence else ""

                output += f"""
## {rb.get('name')}
{rb.get('description', 'No description')}

**Priority**: {rb.get('priority', 100)} | **Times used**: {rb.get('times_triggered', 0)}{conf_str}

### Investigation Steps:
{steps_str}

### If These Conditions Are Found:
{if_found_str if if_found_str else '   (No specific recommendations configured)'}

---
"""

            output += """
**IMPORTANT**: Follow the investigation steps in order. These encode your team's
tribal knowledge about how to investigate this type of issue. When you find one
of the conditions listed, use the corresponding recommendation.
"""

            return output

        except Exception as e:
            return f"Error finding runbooks: {str(e)}"


    @tool
    def get_runbook_recommendation(
        runbook_name: str,
        condition_found: str,
    ) -> str:
        """
        Get the recommendation for a specific condition from a runbook.

        Use this when you've found a condition during investigation and want
        to get the team's documented recommendation for handling it.

        Args:
            runbook_name: Name of the runbook being followed
            condition_found: The condition that was found (e.g., "recent_deployment", "high_error_rate")

        Returns:
            The recommended action for this condition
        """
        try:
            supabase = get_supabase_client()

            query = supabase.from_("runbooks").select(
                "name, if_found_actions"
            ).ilike("name", f"%{runbook_name}%")

            if org_id:
                query = query.eq("org_id", org_id)

            result = query.limit(1).execute()

            if not result.data:
                return f"Runbook '{runbook_name}' not found."

            runbook = result.data[0]
            if_found = runbook.get("if_found_actions", {})

            # Normalize the condition key
            condition_key = condition_found.lower().replace(" ", "_")

            # Try exact match first
            if condition_key in if_found:
                return f"**Recommendation for '{condition_found}'**:\n\n{if_found[condition_key]}"

            # Try partial match
            for key, value in if_found.items():
                if condition_key in key.lower() or key.lower() in condition_key:
                    return f"**Recommendation for '{key}'** (closest match):\n\n{value}"

            # List available conditions
            available = ", ".join(if_found.keys()) if if_found else "none"
            return f"No recommendation found for '{condition_found}'. Available conditions: {available}"

        except Exception as e:
            return f"Error getting recommendation: {str(e)}"


    @tool
    def record_runbook_execution(
        runbook_name: str,
        investigation_id: str | None = None,
        steps_executed: list[dict] | None = None,
        findings: list[str] | None = None,
        conclusion: str | None = None,
        matched_condition: str | None = None,
        confidence_score: float | None = None,
    ) -> str:
        """
        Record that a runbook was executed during an investigation.

        Call this when you complete a runbook-guided investigation to track
        its usage and effectiveness.

        Args:
            runbook_name: Name of the runbook that was followed
            investigation_id: The investigation ID (if available)
            steps_executed: List of steps that were executed with results
            findings: List of key findings
            conclusion: The final conclusion/root cause
            matched_condition: Which if_found condition matched (if any)
            confidence_score: Confidence in the conclusion (0-1)

        Returns:
            Confirmation of the recorded execution
        """
        try:
            supabase = get_supabase_client()

            # Find the runbook
            query = supabase.from_("runbooks").select("id, org_id, times_triggered").ilike("name", f"%{runbook_name}%")

            if org_id:
                query = query.eq("org_id", org_id)

            result = query.limit(1).execute()

            if not result.data:
                return f"Runbook '{runbook_name}' not found. Execution not recorded."

            runbook = result.data[0]
            runbook_id = runbook["id"]
            runbook_org_id = runbook.get("org_id") or org_id

            # Create execution record
            execution_data = {
                "runbook_id": runbook_id,
                "org_id": runbook_org_id,
                "trigger_source": "investigation",
                "status": "completed",
                "steps_executed": steps_executed or [],
                "findings": findings or [],
                "conclusion": conclusion,
                "matched_condition": matched_condition,
                "confidence_score": confidence_score,
            }

            if investigation_id:
                execution_data["investigation_id"] = investigation_id

            supabase.from_("runbook_executions").insert(execution_data).execute()

            # Update runbook stats
            supabase.from_("runbooks").update({
                "times_triggered": (runbook.get("times_triggered") or 0) + 1,
                "last_triggered_at": "now()",
            }).eq("id", runbook_id).execute()

            return f"Runbook execution recorded for '{runbook_name}'."

        except Exception as e:
            return f"Error recording execution: {str(e)}"


    return [find_matching_runbooks, get_runbook_recommendation, record_runbook_execution]
