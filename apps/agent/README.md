# Scout Investigation Agent

Python LangGraph agent for automated SRE incident investigation.

## Features

- Automated incident triage and investigation
- Integration with Datadog (metrics, logs, monitors)
- Integration with GitHub (deployments, commits)
- Integration with Slack (notifications, updates)
- LangSmith tracing and monitoring

## Development

```bash
# Install dependencies
pip install -e .

# Run development server
langgraph dev --port 2024

# Or use the root command
cd ../.. && npm run dev:agent
```

## Environment Variables

Create a `.env` file:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

LANGSMITH_API_KEY=lsv2_pt_...
LANGSMITH_TRACING=true
LANGSMITH_PROJECT=scout
```

## Project Structure

```
src/
├── graph.py             # Main LangGraph agent definition
├── simple_graph.py      # Simple test agent
└── tools/               # Agent tools
    ├── datadog.py       # Datadog integration tools
    ├── github.py        # GitHub integration tools
    └── slack.py         # Slack integration tools
```

## Tools

### Memory Tools (Incident History)
- `search_similar_incidents` - Find past incidents for same service/alert
- `get_incident_details` - Get full details of a specific past incident
- `get_service_incident_history` - Understand patterns for a service

### Datadog Tools
- `get_monitor_details` - Get alert/monitor information
- `get_apm_service_summary` - Service health overview
- `query_metrics` - Custom metric queries
- `search_logs` - Log search and analysis
- `get_datadog_events` - Deployment and config events

### GitHub Tools
- `get_recent_deployments` - Find recent deployments
- `get_deployment_commits` - Analyze commit changes
- `get_recent_commits` - Browse commit history

### Slack Tools
- `send_investigation_result` - Post investigation findings
- `send_investigation_update` - Progress updates

## Deployment

Deployed automatically to LangGraph Cloud on push to `main` branch.

See `langgraph.json` for configuration.

