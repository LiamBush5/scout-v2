"""
Incident Memory Tools for the SRE Investigation Agent.

Allows the agent to search and reference past incidents to:
- Identify recurring issues
- Reference what worked before
- Avoid repeating failed approaches
"""

import os
from datetime import datetime, timedelta
from langchain_core.tools import tool
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Create a Supabase client."""
    url = os.getenv("SUPABASE_URL", "https://zokozwblvsdfldvwflhm.supabase.co")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY required for memory access")

    return create_client(url, key)


def create_memory_tools(org_id: str | None = None) -> list:
    """
    Create incident memory tools for the agent.

    Args:
        org_id: Organization ID to scope queries to

    Returns:
        List of LangChain tools
    """

    @tool
    def search_similar_incidents(
        service: str | None = None,
        alert_name: str | None = None,
        keywords: str | None = None,
        days_back: int = 30,
        limit: int = 5,
    ) -> str:
        """
        Search for similar past incidents to reference during investigation.

        Use this to:
        - Check if this alert has happened before
        - Find what the root cause was last time
        - See what actions resolved the issue

        Args:
            service: Filter by service name (e.g., "api-gateway", "payment-service")
            alert_name: Filter by alert/monitor name
            keywords: Search keywords in summary and root_cause (e.g., "database", "timeout")
            days_back: How many days back to search (default: 30)
            limit: Maximum results to return (default: 5)

        Returns:
            Summary of similar past incidents with root causes and resolutions
        """
        try:
            supabase = get_supabase_client()

            # Build query
            query = supabase.from_("investigations").select(
                "id, service, alert_name, severity, status, "
                "summary, root_cause, confidence_score, "
                "suggested_actions, created_at, duration_ms, "
                "feedback_rating"
            ).eq("status", "completed")

            # Scope to organization if provided
            if org_id:
                query = query.eq("org_id", org_id)

            # Apply filters
            if service:
                query = query.ilike("service", f"%{service}%")

            if alert_name:
                query = query.ilike("alert_name", f"%{alert_name}%")

            # Date filter
            cutoff = datetime.utcnow() - timedelta(days=days_back)
            query = query.gte("created_at", cutoff.isoformat())

            # Order by recency
            query = query.order("created_at", desc=True).limit(limit)

            result = query.execute()

            if not result.data:
                return f"No similar incidents found in the past {days_back} days."

            # Format results
            incidents = []
            for inc in result.data:
                # Parse suggested actions
                actions = inc.get("suggested_actions", [])
                if isinstance(actions, list) and actions:
                    actions_str = "\n      - " + "\n      - ".join(str(a) for a in actions[:3])
                else:
                    actions_str = " None recorded"

                # Calculate how long ago
                created = datetime.fromisoformat(inc["created_at"].replace("Z", "+00:00"))
                days_ago = (datetime.now(created.tzinfo) - created).days

                # Feedback indicator
                feedback = ""
                if inc.get("feedback_rating") == "helpful":
                    feedback = " ✓ Marked helpful"
                elif inc.get("feedback_rating") == "not_helpful":
                    feedback = " ✗ Marked not helpful"

                incidents.append(f"""
**{inc.get('alert_name', 'Unknown Alert')}** on `{inc.get('service', 'unknown')}`
   - When: {days_ago} days ago ({inc['created_at'][:10]}){feedback}
   - Severity: {inc.get('severity', 'unknown')}
   - Root Cause: {inc.get('root_cause', 'Not identified')}
   - Confidence: {int((inc.get('confidence_score') or 0) * 100)}%
   - Actions Taken:{actions_str}
   - Duration: {inc.get('duration_ms', 0) // 1000}s
   - ID: {inc['id'][:8]}...
""")

            header = f"Found {len(incidents)} similar incident(s) in the past {days_back} days:\n"
            return header + "\n".join(incidents)

        except Exception as e:
            return f"Error searching incidents: {str(e)}"


    @tool
    def get_incident_details(incident_id: str) -> str:
        """
        Get full details of a specific past incident.

        Use this after search_similar_incidents to get more context about
        a specific incident that seems relevant.

        Args:
            incident_id: The incident ID (can be partial, first 8 chars)

        Returns:
            Full incident details including findings and deployments
        """
        try:
            supabase = get_supabase_client()

            # Query with partial ID match
            query = supabase.from_("investigations").select("*")

            if org_id:
                query = query.eq("org_id", org_id)

            # Support partial ID (first 8 chars)
            if len(incident_id) < 36:
                query = query.ilike("id", f"{incident_id}%")
            else:
                query = query.eq("id", incident_id)

            result = query.limit(1).execute()

            if not result.data:
                return f"Incident {incident_id} not found."

            inc = result.data[0]

            # Format findings
            findings = inc.get("findings", [])
            if isinstance(findings, list) and findings:
                findings_str = "\n".join(f"  - {f}" for f in findings)
            else:
                findings_str = "  No findings recorded"

            # Format suggested actions
            actions = inc.get("suggested_actions", [])
            if isinstance(actions, list) and actions:
                actions_str = "\n".join(f"  - {a}" for a in actions)
            else:
                actions_str = "  No actions recorded"

            # Format deployments
            deployments = inc.get("deployments_found", [])
            if isinstance(deployments, list) and deployments:
                deploys_str = "\n".join(
                    f"  - {d.get('sha', 'unknown')[:8]} by {d.get('author', 'unknown')} - {d.get('message', '')[:50]}"
                    for d in deployments[:5]
                )
            else:
                deploys_str = "  No deployments recorded"

            return f"""
## Incident Details: {inc['id'][:8]}

**Alert**: {inc.get('alert_name', 'Unknown')}
**Service**: {inc.get('service', 'Unknown')}
**Environment**: {inc.get('environment', 'prod')}
**Severity**: {inc.get('severity', 'unknown')}
**Status**: {inc.get('status', 'unknown')}

**Trigger**: {inc.get('trigger_type', 'unknown')}
**Monitor ID**: {inc.get('monitor_id', 'N/A')}

### Timeline
- Created: {inc.get('created_at', 'unknown')}
- Started: {inc.get('started_at', 'unknown')}
- Completed: {inc.get('completed_at', 'unknown')}
- Duration: {inc.get('duration_ms', 0) // 1000}s

### Root Cause Analysis
**Root Cause**: {inc.get('root_cause', 'Not identified')}
**Confidence**: {int((inc.get('confidence_score') or 0) * 100)}%

### Summary
{inc.get('summary', 'No summary available')}

### Findings
{findings_str}

### Suggested Actions
{actions_str}

### Related Deployments
{deploys_str}

### Feedback
Rating: {inc.get('feedback_rating', 'No feedback')}
Comment: {inc.get('feedback_comment', 'No comment')}
"""

        except Exception as e:
            return f"Error fetching incident details: {str(e)}"


    @tool
    def get_service_incident_history(service: str, days_back: int = 90) -> str:
        """
        Get incident history summary for a specific service.

        Use this to understand:
        - How often this service has issues
        - Common failure patterns
        - Whether issues are getting better or worse

        Args:
            service: The service name to analyze
            days_back: How many days of history to analyze (default: 90)

        Returns:
            Summary of incident patterns for the service
        """
        try:
            supabase = get_supabase_client()

            cutoff = datetime.utcnow() - timedelta(days=days_back)

            query = supabase.from_("investigations").select(
                "id, alert_name, severity, root_cause, confidence_score, "
                "created_at, feedback_rating"
            ).eq("status", "completed").ilike("service", f"%{service}%").gte(
                "created_at", cutoff.isoformat()
            ).order("created_at", desc=True)

            if org_id:
                query = query.eq("org_id", org_id)

            result = query.execute()

            if not result.data:
                return f"No incidents found for service '{service}' in the past {days_back} days. This is a good sign!"

            incidents = result.data

            # Analyze patterns
            total = len(incidents)
            by_severity = {}
            by_root_cause = {}
            helpful_count = 0

            for inc in incidents:
                # Count by severity
                sev = inc.get("severity", "unknown")
                by_severity[sev] = by_severity.get(sev, 0) + 1

                # Count by root cause (simplified)
                rc = inc.get("root_cause", "Unknown")
                if rc:
                    # Extract key terms
                    rc_lower = rc.lower()
                    if "deploy" in rc_lower or "commit" in rc_lower:
                        key = "Deployment-related"
                    elif "database" in rc_lower or "db" in rc_lower:
                        key = "Database-related"
                    elif "timeout" in rc_lower or "latency" in rc_lower:
                        key = "Performance/Timeout"
                    elif "memory" in rc_lower or "cpu" in rc_lower:
                        key = "Resource exhaustion"
                    elif "config" in rc_lower:
                        key = "Configuration"
                    else:
                        key = "Other"
                    by_root_cause[key] = by_root_cause.get(key, 0) + 1

                if inc.get("feedback_rating") == "helpful":
                    helpful_count += 1

            # Format severity breakdown
            sev_str = ", ".join(f"{k}: {v}" for k, v in sorted(by_severity.items()))

            # Format root cause patterns
            rc_sorted = sorted(by_root_cause.items(), key=lambda x: x[1], reverse=True)
            rc_str = "\n".join(f"  - {k}: {v} incidents ({v*100//total}%)" for k, v in rc_sorted)

            # Recent incidents
            recent = incidents[:3]
            recent_str = "\n".join(
                f"  - {inc.get('alert_name', 'Unknown')}: {inc.get('root_cause', 'Unknown')[:60]}..."
                for inc in recent
            )

            return f"""
## Incident History for `{service}` (past {days_back} days)

**Total Incidents**: {total}
**By Severity**: {sev_str}
**Investigation Accuracy**: {helpful_count}/{total} marked helpful ({helpful_count*100//total if total else 0}%)

### Common Root Causes
{rc_str}

### Most Recent Incidents
{recent_str}

### Recommendation
{"⚠️ High incident frequency - consider reviewing service reliability" if total > 10 else "✓ Normal incident frequency" if total > 0 else "✓ No incidents - service appears stable"}
"""

        except Exception as e:
            return f"Error analyzing service history: {str(e)}"


    return [search_similar_incidents, get_incident_details, get_service_incident_history]

