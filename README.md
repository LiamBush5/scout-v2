# Scout AI - SRE Investigation Agent

An AI-powered SRE agent that automatically investigates production incidents by analyzing Datadog alerts, correlating with recent deployments, and reporting findings to Slack.

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

## Prerequisites

- Node.js 18+
- Python 3.11+
- Supabase account
- Datadog account (for monitoring integration)
- GitHub App (for deployment tracking)
- Slack App (for notifications)

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for the agent
cd apps/agent
pip install -e .
```

### 2. Environment Setup

Copy the environment template and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `OPENROUTER_API_KEY` - OpenRouter API key for LLM access
- `LANGSMITH_API_KEY` - LangSmith API key for tracing

### 3. Run Development Servers

```bash
# Terminal 1: Run the web dashboard
npm run dev:web

# Terminal 2: Run the LangGraph agent
npm run dev:agent
```

- Web Dashboard: http://localhost:3000
- Agent API: http://127.0.0.1:2024
- Agent Studio: https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024

## Architecture

### Web Dashboard (`apps/web`)
- Next.js 16 with App Router
- Supabase for auth and database
- Integration management UI
- Investigation history and results

### Investigation Agent (`apps/agent`)
- LangGraph-based agent with tool calling
- OpenRouter for LLM access (Grok 4.1)
- Specialized tools for:
  - **Datadog**: Query metrics, search logs, get monitor details
  - **GitHub**: Find recent deployments, analyze commits
  - **Slack**: Send investigation results and updates

## Integrations

### Datadog
Connect your Datadog account to:
- Receive webhook alerts
- Query metrics and logs
- Get APM service health

### GitHub
Install the GitHub App to:
- Track deployments
- Analyze recent commits
- Identify high-risk changes

### Slack
Connect Slack to:
- Receive investigation results
- Get progress updates
- Provide feedback on findings

## Development

```bash
# Run web in development
npm run dev:web

# Run agent in development
npm run dev:agent

# Build for production
npm run build

# Run linting
npm run lint
```

## License

Private - All rights reserved

