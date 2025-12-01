# Scout AI

An AI-powered SRE agent that automatically investigates production incidents by analyzing Datadog alerts, correlating with recent deployments, and reporting findings to Slack.

## Overview

Scout AI reduces Mean Time to Resolution (MTTR) by automatically:

1. **Detecting incidents** via Datadog webhook alerts
2. **Investigating root cause** by checking recent deployments and analyzing metrics/logs
3. **Reporting findings** to Slack with confidence levels and recommended actions

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Datadog      │────▶│   Scout Web     │────▶│  Scout Agent    │
│   (Webhooks)    │     │   (Next.js)     │     │  (LangGraph)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │                        │
                               ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │    Supabase     │     │   OpenRouter    │
                        │  (Auth + DB)    │     │     (LLM)       │
                        └─────────────────┘     └─────────────────┘
```

## Project Structure

```
scout/
├── apps/
│   ├── web/              # Next.js frontend dashboard
│   └── agent/            # Python LangGraph investigation agent
├── supabase/             # Database migrations and setup
├── docs/                 # Documentation
└── .github/workflows/    # CI/CD pipelines
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- OpenRouter API key

### Installation

```bash
# Clone the repository
git clone https://github.com/LiamBush5/scout-v2.git
cd scout-v2

# Install web dependencies
cd apps/web && npm install

# Install agent dependencies
cd ../agent && pip install -e .
```

### Development

```bash
# Terminal 1: Run web dashboard
cd apps/web && npm run dev

# Terminal 2: Run agent
cd apps/agent && langgraph dev --port 2024
```

- Web Dashboard: http://localhost:3000
- Agent API: http://127.0.0.1:2024
- Agent Studio: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024

## Integrations

| Integration | Purpose |
|-------------|---------|
| **Datadog** | Monitor alerts, metrics, logs, APM |
| **GitHub** | Deployment tracking, commit analysis |
| **Slack** | Investigation results, team notifications |

## Deployment

| App | Platform | Trigger |
|-----|----------|---------|
| Web | Vercel | Push to `main` (apps/web changes) |
| Agent | LangGraph Cloud | Push to `main` (apps/agent changes) |

## Documentation

- [Product Spec](docs/product-spec.md)
- [API Reference](docs/api-reference.md)
- [Code Review Standards](docs/code-review.md)
- [Quickstart Guide](docs/quickstart.md)

## License

Private - All rights reserved
