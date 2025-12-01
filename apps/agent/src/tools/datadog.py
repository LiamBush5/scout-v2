"""
Datadog tools for the SRE Investigation Agent.

Tools return INTERPRETED data, not raw JSON dumps.
Each tool includes anomaly detection and actionable insights.
"""

from langchain_core.tools import tool
from datetime import datetime
import json


def create_datadog_tools(credentials: dict | None) -> list:
    """
    Create Datadog tools with the provided credentials.

    Args:
        credentials: Dict with api_key, app_key, site
    """

    # -------------------------------------------------------------------------
    # get_monitor_details
    # -------------------------------------------------------------------------

    @tool
    def get_monitor_details(monitor_id: int) -> str:
        """
        Get details about a Datadog monitor that triggered an alert.
        Use this FIRST to understand what condition triggered the investigation.

        Args:
            monitor_id: The Datadog monitor ID from the alert
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Datadog not configured. Please add Datadog credentials (api_key, app_key) in integrations settings."
            })

        try:
            from datadog_api_client import Configuration, ApiClient
            from datadog_api_client.v1.api import monitors_api

            config = Configuration()
            config.api_key["apiKeyAuth"] = credentials["api_key"]
            config.api_key["appKeyAuth"] = credentials["app_key"]
            config.server_variables["site"] = credentials.get("site", "datadoghq.com")

            with ApiClient(config) as api_client:
                api = monitors_api.MonitorsApi(api_client)
                monitor = api.get_monitor(monitor_id)

                return json.dumps({
                    "success": True,
                    "monitor": {
                        "id": monitor.id,
                        "name": monitor.name,
                        "type": str(monitor.type),
                        "query": monitor.query,
                        "state": str(monitor.overall_state),
                        "tags": list(monitor.tags) if monitor.tags else [],
                    },
                    "interpretation": _interpret_monitor(monitor.query or ""),
                }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    def _interpret_monitor(query: str) -> str:
        if "duration" in query.lower():
            return "LATENCY monitor - tracks response times"
        elif "error" in query.lower():
            return "ERROR RATE monitor - tracks failures"
        elif "cpu" in query.lower():
            return "CPU monitor - tracks resource usage"
        elif "memory" in query.lower() or "mem" in query.lower():
            return "MEMORY monitor - tracks resource usage"
        return "Custom monitor - review query for details"

    # -------------------------------------------------------------------------
    # get_apm_service_summary
    # -------------------------------------------------------------------------

    @tool
    def get_apm_service_summary(service_name: str, env: str = "prod", minutes_back: int = 30) -> str:
        """
        Get APM health summary for a service: error rate, latency, throughput.
        HIGH-VALUE tool for triage - understand service health at a glance.

        Args:
            service_name: Service name in Datadog APM
            env: Environment (default: prod)
            minutes_back: Time window (default: 30)
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Datadog not configured. Please add Datadog credentials (api_key, app_key) in integrations settings."
            })

        try:
            from datadog_api_client import Configuration, ApiClient
            from datadog_api_client.v1.api import metrics_api

            config = Configuration()
            config.api_key["apiKeyAuth"] = credentials["api_key"]
            config.api_key["appKeyAuth"] = credentials["app_key"]
            config.server_variables["site"] = credentials.get("site", "datadoghq.com")

            with ApiClient(config) as api_client:
                api = metrics_api.MetricsApi(api_client)
                now = int(datetime.now().timestamp())
                from_ts = now - (minutes_back * 60)

                metrics = {
                    "error_rate": f"sum:trace.http.request.errors{{service:{service_name},env:{env}}}.as_rate()",
                    "latency_p95": f"p95:trace.http.request.duration{{service:{service_name},env:{env}}}",
                    "throughput": f"sum:trace.http.request.hits{{service:{service_name},env:{env}}}.as_rate()",
                }

                results = {}
                issues = []

                for name, query in metrics.items():
                    try:
                        response = api.query_metrics(_from=from_ts, to=now, query=query)
                        if response.series:
                            points = response.series[0].pointlist or []
                            values = [p.value[1] for p in points if p.value is not None and len(p.value) > 1]
                            if values:
                                current = values[-1]
                                if "latency" in name and current > 1000000:
                                    current = current / 1000000
                                results[name] = round(current, 2)

                                if name == "error_rate" and current > 0.01:
                                    issues.append(f"High error rate: {current:.2%}")
                                if name == "latency_p95" and current > 500:
                                    issues.append(f"High P95 latency: {current:.0f}ms")
                    except:
                        results[name] = None

                summary = f"ISSUES: {'; '.join(issues)}" if issues else "Service appears healthy"

                return json.dumps({
                    "success": True,
                    "service": service_name,
                    "summary": summary,
                    "metrics": results,
                    "issues": issues,
                }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    # -------------------------------------------------------------------------
    # query_metrics
    # -------------------------------------------------------------------------

    @tool
    def query_metrics(query: str, minutes_back: int = 30) -> str:
        """
        Query Datadog metrics. Use for testing specific hypotheses.

        Example queries:
        - avg:trace.http.request.errors{service:api}.as_rate()
        - p95:trace.http.request.duration{service:api}
        - avg:system.cpu.user{host:web-*}

        Args:
            query: Datadog metric query
            minutes_back: Time window (default: 30)
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Datadog not configured. Please add Datadog credentials (api_key, app_key) in integrations settings."
            })

        try:
            from datadog_api_client import Configuration, ApiClient
            from datadog_api_client.v1.api import metrics_api

            config = Configuration()
            config.api_key["apiKeyAuth"] = credentials["api_key"]
            config.api_key["appKeyAuth"] = credentials["app_key"]
            config.server_variables["site"] = credentials.get("site", "datadoghq.com")

            with ApiClient(config) as api_client:
                api = metrics_api.MetricsApi(api_client)
                now = int(datetime.now().timestamp())
                from_ts = now - (minutes_back * 60)

                response = api.query_metrics(_from=from_ts, to=now, query=query)

                results = []
                for series in (response.series or []):
                    points = series.pointlist or []
                    values = [p.value[1] for p in points if p.value is not None and len(p.value) > 1]
                    if values:
                        results.append({
                            "scope": series.scope,
                            "latest": round(values[-1], 4),
                            "min": round(min(values), 4),
                            "max": round(max(values), 4),
                            "avg": round(sum(values) / len(values), 4),
                            "trend": "increasing" if values[-1] > values[0] * 1.2 else
                                     "decreasing" if values[-1] < values[0] * 0.8 else "stable",
                        })

                return json.dumps({
                    "success": True,
                    "query": query,
                    "results": results,
                }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    # -------------------------------------------------------------------------
    # search_logs
    # -------------------------------------------------------------------------

    @tool
    def search_logs(query: str, minutes_back: int = 30, limit: int = 50) -> str:
        """
        Search Datadog logs. Use to find error messages and patterns.

        Example queries:
        - service:api status:error
        - service:api @http.status_code:>=500
        - "connection refused"

        Args:
            query: Datadog log query
            minutes_back: Time window (default: 30)
            limit: Max logs to return (default: 50)
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Datadog not configured. Please add Datadog credentials (api_key, app_key) in integrations settings."
            })

        try:
            from datadog_api_client import Configuration, ApiClient
            from datadog_api_client.v2.api import logs_api
            from datadog_api_client.v2.model.logs_list_request import LogsListRequest
            from datadog_api_client.v2.model.logs_query_filter import LogsQueryFilter
            from datadog_api_client.v2.model.logs_list_request_page import LogsListRequestPage
            from datadog_api_client.v2.model.logs_sort import LogsSort

            config = Configuration()
            config.api_key["apiKeyAuth"] = credentials["api_key"]
            config.api_key["appKeyAuth"] = credentials["app_key"]
            config.server_variables["site"] = credentials.get("site", "datadoghq.com")

            with ApiClient(config) as api_client:
                api = logs_api.LogsApi(api_client)

                body = LogsListRequest(
                    filter=LogsQueryFilter(
                        query=query,
                        _from=f"now-{minutes_back}m",
                        to="now",
                    ),
                    sort=LogsSort.TIMESTAMP_DESCENDING,
                    page=LogsListRequestPage(limit=limit),
                )
                response = api.list_logs(body=body)

                logs = []
                error_messages = []
                status_counts = {}

                for log in (response.data or []):
                    attrs = log.attributes or {}
                    status = attrs.get("status", "unknown")
                    status_counts[status] = status_counts.get(status, 0) + 1

                    if status in ["error", "critical"]:
                        msg = str(attrs.get("message", ""))[:200]
                        if msg:
                            error_messages.append(msg)

                    logs.append({
                        "timestamp": str(attrs.get("timestamp", ""))[:23],
                        "service": attrs.get("service"),
                        "status": status,
                        "message": str(attrs.get("message", ""))[:200],
                    })

                top_errors = _get_top_patterns(error_messages, 3)

                summary = f"Found {len(logs)} logs. " + (
                    f"Top errors: {'; '.join(top_errors)}" if top_errors else "No errors found."
                )

                return json.dumps({
                    "success": True,
                    "summary": summary,
                    "status_breakdown": status_counts,
                    "top_error_patterns": top_errors,
                    "sample_logs": logs[:10],
                }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    def _get_top_patterns(messages: list, top_n: int = 3) -> list:
        """Extract top error patterns from messages."""
        if not messages:
            return []

        patterns = {}
        for msg in messages:
            key = msg[:50]
            patterns[key] = patterns.get(key, 0) + 1

        sorted_patterns = sorted(patterns.items(), key=lambda x: x[1], reverse=True)
        return [f"{p[0]}... ({p[1]}x)" for p in sorted_patterns[:top_n]]

    # -------------------------------------------------------------------------
    # get_datadog_events
    # -------------------------------------------------------------------------

    @tool
    def get_datadog_events(hours_back: int = 4, tags: list[str] | None = None) -> str:
        """
        Get recent Datadog events including deployments and config changes.
        HIGH-VALUE tool - most incidents are caused by changes.

        Args:
            hours_back: How far back to look (default: 4)
            tags: Filter by tags (e.g., ["service:api"])
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Datadog not configured. Please add Datadog credentials (api_key, app_key) in integrations settings."
            })

        try:
            from datadog_api_client import Configuration, ApiClient
            from datadog_api_client.v1.api import events_api

            config = Configuration()
            config.api_key["apiKeyAuth"] = credentials["api_key"]
            config.api_key["appKeyAuth"] = credentials["app_key"]
            config.server_variables["site"] = credentials.get("site", "datadoghq.com")

            with ApiClient(config) as api_client:
                api = events_api.EventsApi(api_client)
                now = int(datetime.now().timestamp())
                start = now - (hours_back * 3600)

                # Only pass tags parameter if we have tags (empty string causes 500 error)
                if tags:
                    response = api.list_events(
                        start=start,
                        end=now,
                        tags=",".join(tags),
                    )
                else:
                    response = api.list_events(
                        start=start,
                        end=now,
                    )

                events = []
                deployments = []

                for event in (response.events or []):
                    event_data = {
                        "title": (event.title or "")[:100],
                        "timestamp": datetime.fromtimestamp(event.date_happened).isoformat() if event.date_happened else None,
                        "source": event.source,
                        "tags": list(event.tags) if event.tags else [],
                    }
                    events.append(event_data)

                    if event.source in ["deployment", "github", "jenkins", "circleci"] or \
                       "deploy" in (event.title or "").lower():
                        deployments.append(event_data)

                summary = f"{len(deployments)} DEPLOYMENTS found" if deployments else f"No deployments. {len(events)} total events."

                return json.dumps({
                    "success": True,
                    "summary": summary,
                    "deployments": deployments[:10],
                    "all_events": events[:20],
                }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    return [
        get_monitor_details,
        get_apm_service_summary,
        query_metrics,
        search_logs,
        get_datadog_events,
    ]

