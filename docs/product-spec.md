# AI SRE Agent MVP — Complete Product Specification

> **One developer. One step at a time. Ship something phenomenal.**

---

## Table of Contents

1. [Executive Summary](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#executive-summary)
2. [Product Vision](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#product-vision)
3. [Architecture Overview](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#architecture-overview)
4. [Tech Stack](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#tech-stack)
5. [Build Phases](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#build-phases)
6. [Database Schema](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#database-schema)
7. [Agent Implementation](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#agent-implementation)
8. [Integration Implementations](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#integration-implementations)
9. [Frontend Implementation](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#frontend-implementation)
10. [Environment Variables](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#environment-variables)
11. [Deployment Guide](https://claude.ai/chat/4db230bb-e6f2-47e5-9301-72d9a3824eed#deployment-guide)

---

## Executive Summary

### What We're Building

An AI-powered SRE agent that automatically investigates production incidents by correlating data from Datadog, GitHub deployments, and delivering actionable findings to Slack. When an alert fires, the agent:

1. Receives the alert via webhook
2. Investigates using LangGraph ReAct pattern
3. Correlates metrics, logs, traces, and recent deployments
4. Delivers a structured diagnosis to Slack with evidence and recommended actions

### Core Value Proposition

**"From alert to diagnosis in 60 seconds, not 60 minutes."**

* Eliminates the first 5 minutes of context-gathering during incidents
* Correlates Datadog telemetry with GitHub deployment history automatically
* Presents findings with evidence chains engineers can verify
* Learns from your organization's incident patterns over time

### Success Metrics

| Metric                                   | Target                             |
| ---------------------------------------- | ---------------------------------- |
| Time to first investigation              | < 60 seconds after alert           |
| Investigation accuracy                   | > 80% (validated by user feedback) |
| Onboarding completion                    | < 5 minutes                        |
| User activation (first alert configured) | > 60%                              |

---

## Product Vision

### The User Journey

```
1. SIGN UP (30 sec)
   └─> Email/Google auth via Supabase

2. CONNECT INTEGRATIONS (2-3 min)
   └─> GitHub App install (select repos)
   └─> Slack OAuth (select channel)
   └─> Datadog API keys (with guided setup)

3. CONFIGURE FIRST MONITOR (1-2 min)
   └─> Copy webhook URL to Datadog monitor
   └─> Configure alert routing to Slack channel

4. EXPERIENCE FIRST INVESTIGATION (automatic)
   └─> Alert fires → Agent investigates → Slack message delivered

5. ONGOING VALUE
   └─> Every alert gets automatic investigation
   └─> Feedback improves agent accuracy
   └─> Historical incidents build organizational memory
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SYSTEM ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  EXTERNAL SERVICES                     YOUR SAAS                         │
│                                                                          │
│  ┌──────────┐                         ┌─────────────────────────────┐   │
│  │ Datadog  │──webhook──────────────▶│ Vercel Serverless Function  │   │
│  │ Monitors │                         │ (Webhook Receiver)          │   │
│  └──────────┘                         └───────────┬─────────────────┘   │
│                                                   │                      │
│  ┌──────────┐                                     │ insert               │
│  │ GitHub   │◀─────────────────┐                  ▼                      │
│  │ API      │                  │         ┌───────────────────┐          │
│  └──────────┘                  │         │   Supabase DB     │          │
│                                │         │   (Postgres)      │          │
│  ┌──────────┐                  │         │                   │          │
│  │ Datadog  │◀────────┐        │         │ • organizations   │          │
│  │ API      │         │        │         │ • integrations    │          │
│  └──────────┘         │        │         │ • investigations  │          │
│                       │        │         └─────────┬─────────┘          │
│  ┌──────────┐         │        │                   │                     │
│  │ Slack    │◀──┐     │        │                   │ trigger             │
│  │ API      │   │     │        │                   ▼                     │
│  └──────────┘   │     │        │         ┌───────────────────┐          │
│                 │     │        │         │  Vercel Function  │          │
│                 │     │        │         │  (Agent Runner)   │          │
│                 │     │        │         │                   │          │
│                 │     │        │         │  ┌─────────────┐  │          │
│                 │     │        └─────────┼──│ LangGraph   │  │          │
│                 │     │                  │  │ ReAct Agent │  │          │
│                 │     └──────────────────┼──│             │  │          │
│                 │                        │  │ Tools:      │  │          │
│                 └────────────────────────┼──│ • Datadog   │  │          │
│                                          │  │ • GitHub    │  │          │
│                                          │  │ • Slack     │  │          │
│                                          │  └─────────────┘  │          │
│                                          └───────────┬───────┘          │
│                                                      │                   │
│  ┌──────────┐                                        │                   │
│  │LangSmith │◀───────────────────────────────────────┘                   │
│  │ (Traces) │                                                           │
│  └──────────┘                                                           │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      NEXT.JS FRONTEND (Vercel)                   │    │
│  │  • Onboarding wizard    • Integration management                 │    │
│  │  • Investigation history • Settings & configuration              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Core Dependencies

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "@supabase/supabase-js": "^2.43.0",
    "@supabase/ssr": "^0.3.0",
    "@langchain/langgraph": "^0.2.0",
    "@langchain/anthropic": "^0.3.0",
    "@langchain/core": "^0.3.0",
    "langsmith": "^0.1.0",
    "datadog-api-client": "^1.25.0",
    "@slack/web-api": "^7.0.0",
    "@octokit/rest": "^20.0.0",
    "@octokit/auth-app": "^6.0.0",
    "zod": "^3.23.0",
    "zustand": "^4.5.0",
    "react-hook-form": "^7.51.0",
    "@hookform/resolvers": "^3.3.0",
    "framer-motion": "^11.0.0",
    "lucide-react": "^0.378.0",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  }
}
```

---

## Build Phases

### Phase 1: Foundation (Days 1-3)

**Goal:** Project setup, Supabase, and basic auth flow.

#### Step 1.1: Project Initialization

```bash
# Create Next.js project
npx create-next-app@latest sre-agent --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd sre-agent

# Install shadcn/ui
npx shadcn-ui@latest init
# Style: Default, Base color: Slate, CSS variables: Yes

# Add shadcn components
npx shadcn-ui@latest add button card input label toast dialog
npx shadcn-ui@latest add form select checkbox badge avatar dropdown-menu
npx shadcn-ui@latest add skeleton tabs separator alert sonner command

# Install other dependencies
npm install @supabase/supabase-js @supabase/ssr zustand
npm install react-hook-form @hookform/resolvers zod
npm install framer-motion lucide-react
```

#### Step 1.2: Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── investigations/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── settings/
│   │       └── integrations/page.tsx
│   ├── (onboarding)/
│   │   ├── layout.tsx
│   │   ├── welcome/page.tsx
│   │   ├── connect/page.tsx
│   │   └── setup/page.tsx
│   ├── api/
│   │   ├── auth/callback/
│   │   │   ├── github/route.ts
│   │   │   └── slack/route.ts
│   │   ├── webhooks/
│   │   │   └── datadog/route.ts
│   │   └── agent/
│   │       └── investigate/route.ts
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                    # shadcn components
│   ├── onboarding/
│   │   ├── integration-card.tsx
│   │   ├── stepper.tsx
│   │   └── datadog-form.tsx
│   ├── dashboard/
│   │   ├── investigation-card.tsx
│   │   └── stats-cards.tsx
│   └── shared/
│       ├── header.tsx
│       └── sidebar.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   ├── agent/
│   │   ├── graph.ts
│   │   ├── tools/
│   │   │   ├── datadog.ts
│   │   │   ├── github.ts
│   │   │   └── slack.ts
│   │   └── types.ts
│   ├── actions/
│   │   └── integrations.ts
│   ├── stores/
│   │   └── onboarding.ts
│   └── utils.ts
├── types/
│   └── database.ts
└── middleware.ts
```

#### Step 1.3: Supabase Client Setup

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component
          }
        },
      },
    }
  )
}
```

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

#### Step 1.4: Auth Middleware

```typescript
// src/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!user && request.nextUrl.pathname.startsWith('/onboarding')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect authenticated users from auth pages
  if (user && ['/login', '/signup'].includes(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
```

---

### Phase 2: Database Schema (Day 2)

Run this SQL in Supabase SQL Editor:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization members
CREATE TABLE org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- Integrations (connection status, not credentials)
CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('datadog', 'slack', 'github')),
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connected', 'error')),
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, provider)
);

-- Investigations
CREATE TABLE investigations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,

  -- Trigger info
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('datadog_monitor', 'manual', 'scheduled')),
  trigger_id TEXT,
  trigger_payload JSONB,

  -- Status
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),

  -- Results
  summary TEXT,
  findings JSONB,
  suggested_actions JSONB,
  confidence_score DECIMAL(3,2),

  -- Feedback
  user_feedback TEXT CHECK (user_feedback IN ('helpful', 'not_helpful', 'incorrect')),
  user_feedback_comment TEXT,

  -- Tracing
  langsmith_run_id TEXT,
  langsmith_url TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE investigations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view org members"
  ON org_members FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage org integrations"
  ON integrations FOR ALL
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

CREATE POLICY "Users can view org investigations"
  ON investigations FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_investigations_org_id ON investigations(org_id);
CREATE INDEX idx_investigations_status ON investigations(status);
CREATE INDEX idx_investigations_created_at ON investigations(created_at DESC);
CREATE INDEX idx_org_members_user_id ON org_members(user_id);

-- Auto-create org on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
BEGIN
  INSERT INTO organizations (name, slug)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'company', NEW.email),
    LOWER(REPLACE(COALESCE(NEW.raw_user_meta_data->>'company', split_part(NEW.email, '@', 1)), ' ', '-')) || '-' || substr(gen_random_uuid()::text, 1, 8)
  )
  RETURNING id INTO new_org_id;

  INSERT INTO org_members (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  UPDATE auth.users
  SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('org_id', new_org_id)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE investigations;
```

---

### Phase 3: Core Agent (Days 3-5)

**Goal:** Build the LangGraph investigation agent with Datadog tools.

#### Step 3.1: Install Agent Dependencies

```bash
npm install @langchain/langgraph @langchain/anthropic @langchain/core langsmith
npm install datadog-api-client @slack/web-api @octokit/rest @octokit/auth-app
```

#### Step 3.2: Agent Types

```typescript
// src/lib/agent/types.ts
import type { BaseMessage } from '@langchain/core/messages'

export interface InvestigationContext {
  investigationId: string
  orgId: string
  trigger: {
    type: 'datadog_monitor' | 'manual' | 'scheduled'
    id?: string
    payload: Record<string, unknown>
  }
  credentials: {
    datadog?: {
      apiKey: string
      appKey: string
      site: string
    }
    github?: {
      installationId: number
      privateKey: string
      appId: string
    }
    slack?: {
      botToken: string
      channelId: string
    }
  }
}

export interface InvestigationResult {
  summary: string
  rootCause: string | null
  findings: Finding[]
  suggestedActions: SuggestedAction[]
  confidence: number
  durationMs: number
  langsmithUrl?: string
}

export interface Finding {
  category: 'root_cause' | 'contributing_factor' | 'symptom' | 'correlation'
  description: string
  confidence: number
  evidence: Evidence[]
}

export interface Evidence {
  type: 'metric' | 'log' | 'deployment' | 'event'
  source: string
  data: Record<string, unknown>
  timestamp: string
}

export interface SuggestedAction {
  priority: 1 | 2 | 3
  action: string
  command?: string
  automated: boolean
}
```

#### Step 3.3: Datadog Tools

```typescript
// src/lib/agent/tools/datadog.ts
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { v1, v2, client } from '@datadog/datadog-api-client'

export function createDatadogTools(credentials: {
  apiKey: string
  appKey: string
  site: string
}) {
  const configuration = client.createConfiguration({
    authMethods: {
      apiKeyAuth: credentials.apiKey,
      appKeyAuth: credentials.appKey,
    },
  })
  configuration.setServerVariables({ site: credentials.site })

  const metricsApi = new v1.MetricsApi(configuration)
  const logsApi = new v2.LogsApi(configuration)
  const monitorsApi = new v1.MonitorsApi(configuration)

  const queryMetrics = tool(
    async ({ query, minutesBack }) => {
      const now = Math.floor(Date.now() / 1000)
      const from = now - minutesBack * 60

      try {
        const response = await metricsApi.queryMetrics({ from, to: now, query })
        const series = response.series || []

        const results = series.map((s) => {
          const points = s.pointlist || []
          const values = points.map((p) => p[1]).filter((v): v is number => v !== null)

          return {
            scope: s.scope,
            metric: s.metric,
            latestValue: values[values.length - 1] ?? null,
            min: values.length ? Math.min(...values) : null,
            max: values.length ? Math.max(...values) : null,
            avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
          }
        })

        return JSON.stringify({ success: true, query, results })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    },
    {
      name: 'query_datadog_metrics',
      description: `Query Datadog metrics. Common patterns:
- avg:system.cpu.user{host:web-*} - CPU usage
- sum:trace.http.request.errors{service:api}.as_rate() - Error rate
- p95:trace.http.request.duration{service:api} - P95 latency`,
      schema: z.object({
        query: z.string().describe('Datadog metric query'),
        minutesBack: z.number().default(30).describe('Minutes of data to fetch'),
      }),
    }
  )

  const searchLogs = tool(
    async ({ query, minutesBack, limit }) => {
      try {
        const response = await logsApi.listLogs({
          body: {
            filter: { query, from: `now-${minutesBack}m`, to: 'now' },
            sort: '-timestamp',
            page: { limit },
          },
        })

        const logs = (response.data || []).map((log) => ({
          timestamp: log.attributes?.timestamp,
          service: log.attributes?.service,
          status: log.attributes?.status,
          message: (log.attributes?.message as string)?.slice(0, 500),
        }))

        return JSON.stringify({ success: true, query, count: logs.length, logs })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    },
    {
      name: 'search_datadog_logs',
      description: `Search Datadog logs. Examples:
- service:api status:error - Errors from a service
- @http.status_code:[500 TO 599] - HTTP 5xx errors`,
      schema: z.object({
        query: z.string().describe('Datadog log query'),
        minutesBack: z.number().default(30),
        limit: z.number().default(50),
      }),
    }
  )

  const getMonitorDetails = tool(
    async ({ monitorId }) => {
      try {
        const monitor = await monitorsApi.getMonitor({ monitorId })
        return JSON.stringify({
          success: true,
          monitor: {
            id: monitor.id,
            name: monitor.name,
            type: monitor.type,
            query: monitor.query,
            overallState: monitor.overallState,
            tags: monitor.tags,
          },
        })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    },
    {
      name: 'get_datadog_monitor',
      description: 'Get details about a specific Datadog monitor by ID',
      schema: z.object({
        monitorId: z.number().describe('The Datadog monitor ID'),
      }),
    }
  )

  const getApmServiceSummary = tool(
    async ({ serviceName, env, minutesBack }) => {
      const now = Math.floor(Date.now() / 1000)
      const from = now - minutesBack * 60

      const queries = {
        errorRate: `sum:trace.http.request.errors{service:${serviceName},env:${env}}.as_rate()`,
        latencyP95: `p95:trace.http.request.duration{service:${serviceName},env:${env}}`,
        throughput: `sum:trace.http.request.hits{service:${serviceName},env:${env}}.as_rate()`,
      }

      const results: Record<string, number | null> = {}

      for (const [name, query] of Object.entries(queries)) {
        try {
          const response = await metricsApi.queryMetrics({ from, to: now, query })
          const points = response.series?.[0]?.pointlist || []
          const values = points.map((p) => p[1]).filter((v): v is number => v !== null)
          results[name] = values[values.length - 1] ?? null
        } catch {
          results[name] = null
        }
      }

      return JSON.stringify({ success: true, service: serviceName, env, metrics: results })
    },
    {
      name: 'get_apm_service_summary',
      description: 'Get APM summary (error rate, latency, throughput) for a service',
      schema: z.object({
        serviceName: z.string().describe('Service name in Datadog APM'),
        env: z.string().default('prod'),
        minutesBack: z.number().default(60),
      }),
    }
  )

  return [queryMetrics, searchLogs, getMonitorDetails, getApmServiceSummary]
}
```

#### Step 3.4: GitHub Tools

```typescript
// src/lib/agent/tools/github.ts
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export function createGitHubTools(credentials: {
  appId: string
  privateKey: string
  installationId: number
}) {
  const octokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: credentials.appId,
      privateKey: credentials.privateKey,
      installationId: credentials.installationId,
    },
  })

  const getRecentDeployments = tool(
    async ({ owner, repo, hoursBack, environment }) => {
      try {
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

        const { data: deployments } = await octokit.repos.listDeployments({
          owner,
          repo,
          environment,
          per_page: 20,
        })

        const recent = deployments
          .filter((d) => new Date(d.created_at) > new Date(since))
          .slice(0, 10)
          .map((d) => ({
            id: d.id,
            sha: d.sha.slice(0, 7),
            ref: d.ref,
            environment: d.environment,
            creator: d.creator?.login,
            createdAt: d.created_at,
          }))

        return JSON.stringify({ success: true, repo: `${owner}/${repo}`, deployments: recent })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    },
    {
      name: 'get_github_deployments',
      description: 'Get recent deployments from a GitHub repository',
      schema: z.object({
        owner: z.string().describe('Repository owner'),
        repo: z.string().describe('Repository name'),
        hoursBack: z.number().default(24),
        environment: z.string().optional().describe('Filter by environment'),
      }),
    }
  )

  const getRecentCommits = tool(
    async ({ owner, repo, hoursBack }) => {
      try {
        const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString()

        const { data: commits } = await octokit.repos.listCommits({
          owner,
          repo,
          since,
          per_page: 20,
        })

        const recent = commits.map((c) => ({
          sha: c.sha.slice(0, 7),
          message: c.commit.message.split('\n')[0].slice(0, 100),
          author: c.commit.author?.name,
          date: c.commit.author?.date,
        }))

        return JSON.stringify({ success: true, repo: `${owner}/${repo}`, commits: recent })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    },
    {
      name: 'get_github_commits',
      description: 'Get recent commits from a GitHub repository',
      schema: z.object({
        owner: z.string(),
        repo: z.string(),
        hoursBack: z.number().default(24),
      }),
    }
  )

  return [getRecentDeployments, getRecentCommits]
}
```

#### Step 3.5: Slack Tools

```typescript
// src/lib/agent/tools/slack.ts
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { WebClient } from '@slack/web-api'

export function createSlackTools(credentials: {
  botToken: string
  defaultChannelId: string
}) {
  const slack = new WebClient(credentials.botToken)

  const sendInvestigationResult = tool(
    async ({ channelId, summary, rootCause, confidence, suggestedActions, datadogLink }) => {
      try {
        const confidenceEmoji = confidence >= 0.8 ? '🟢' : confidence >= 0.6 ? '🟡' : '🔴'

        const blocks: any[] = [
          {
            type: 'header',
            text: { type: 'plain_text', text: '🔍 Investigation Complete', emoji: true },
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*Summary*\n${summary}` },
          },
          { type: 'divider' },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Root Cause*\n${rootCause || 'Unable to determine'}` },
              { type: 'mrkdwn', text: `*Confidence*\n${confidenceEmoji} ${Math.round(confidence * 100)}%` },
            ],
          },
        ]

        if (suggestedActions?.length) {
          blocks.push({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Suggested Actions*\n${suggestedActions
                .map((a: any, i: number) => `${i + 1}. ${a.action}${a.command ? `\n   \`${a.command}\`` : ''}`)
                .join('\n')}`,
            },
          })
        }

        blocks.push({
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: '👍 Helpful' }, action_id: 'feedback_helpful', style: 'primary' },
            { type: 'button', text: { type: 'plain_text', text: '👎 Not Helpful' }, action_id: 'feedback_not_helpful' },
            ...(datadogLink ? [{ type: 'button', text: { type: 'plain_text', text: '📊 View in Datadog' }, url: datadogLink }] : []),
          ],
        })

        const response = await slack.chat.postMessage({
          channel: channelId || credentials.defaultChannelId,
          text: `Investigation Complete: ${summary}`,
          blocks,
        })

        return JSON.stringify({ success: true, messageTs: response.ts })
      } catch (error) {
        return JSON.stringify({ success: false, error: String(error) })
      }
    },
    {
      name: 'send_slack_investigation_result',
      description: 'Send investigation results to Slack',
      schema: z.object({
        channelId: z.string().optional(),
        summary: z.string(),
        rootCause: z.string().optional(),
        confidence: z.number().min(0).max(1),
        suggestedActions: z.array(z.object({
          priority: z.number(),
          action: z.string(),
          command: z.string().optional(),
        })).optional(),
        datadogLink: z.string().optional(),
      }),
    }
  )

  return [sendInvestigationResult]
}
```

#### Step 3.6: LangGraph Agent

```typescript
// src/lib/agent/graph.ts
import { StateGraph, END, START, Annotation } from '@langchain/langgraph'
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { ChatAnthropic } from '@langchain/anthropic'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import { traceable } from 'langsmith/traceable'
import { createDatadogTools } from './tools/datadog'
import { createGitHubTools } from './tools/github'
import { createSlackTools } from './tools/slack'
import type { InvestigationContext, InvestigationResult } from './types'

const SYSTEM_PROMPT = `You are an expert SRE investigating a production incident. Your goal is to identify the root cause and provide actionable recommendations.

## Investigation Methodology

1. TRIAGE (First 30 seconds)
   - Understand what triggered the alert
   - Assess severity using Golden Signals (Latency, Traffic, Errors, Saturation)

2. INVESTIGATION (2-3 minutes)
   - Check for recent deployments (HIGHEST PRIORITY - always do this first)
   - Query relevant metrics around the alert time
   - Search logs for errors and anomalies

3. CORRELATION
   - Correlate timing between changes and symptoms
   - Follow the dependency chain upstream

4. CONCLUSION
   - Summarize findings with evidence
   - Provide specific, actionable recommendations
   - Assign confidence level

## Important
- ALWAYS check for recent deployments first
- Be concise - engineers are being paged
- Include evidence for claims
- If confidence is low, say so`

const InvestigationStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  context: Annotation<InvestigationContext>(),
  iterations: Annotation<number>({ default: () => 0 }),
})

type InvestigationState = typeof InvestigationStateAnnotation.State

export async function createInvestigationGraph(context: InvestigationContext) {
  const llm = new ChatAnthropic({
    modelName: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0,
  })

  const tools: any[] = []

  if (context.credentials.datadog) {
    tools.push(...createDatadogTools(context.credentials.datadog))
  }
  if (context.credentials.github) {
    tools.push(...createGitHubTools(context.credentials.github))
  }
  if (context.credentials.slack) {
    tools.push(...createSlackTools(context.credentials.slack))
  }

  const llmWithTools = llm.bindTools(tools)
  const toolNode = new ToolNode(tools)

  async function agentNode(state: InvestigationState): Promise<Partial<InvestigationState>> {
    const response = await llmWithTools.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      ...state.messages,
    ])
    return { messages: [response], iterations: state.iterations + 1 }
  }

  function shouldContinue(state: InvestigationState): 'tools' | 'end' {
    const lastMessage = state.messages[state.messages.length - 1]
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length && state.iterations < 15) {
      return 'tools'
    }
    return 'end'
  }

  const graph = new StateGraph(InvestigationStateAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue, { tools: 'tools', end: END })
    .addEdge('tools', 'agent')

  return graph.compile()
}

export const runInvestigation = traceable(
  async function runInvestigation(context: InvestigationContext): Promise<InvestigationResult> {
    const startTime = Date.now()
    const graph = await createInvestigationGraph(context)

    const triggerMessage = formatTriggerMessage(context.trigger)

    const result = await graph.invoke({
      messages: [new HumanMessage(triggerMessage)],
      context,
      iterations: 0,
    })

    const finalMessage = result.messages[result.messages.length - 1]
    const content = typeof finalMessage.content === 'string'
      ? finalMessage.content
      : JSON.stringify(finalMessage.content)

    return {
      summary: content.split('\n')[0] || content.slice(0, 200),
      rootCause: null,
      findings: [],
      suggestedActions: [],
      confidence: 0.7,
      durationMs: Date.now() - startTime,
    }
  },
  { name: 'run_investigation', run_type: 'chain' }
)

function formatTriggerMessage(trigger: InvestigationContext['trigger']): string {
  if (trigger.type === 'datadog_monitor') {
    const payload = trigger.payload as Record<string, any>
    return `A Datadog alert has fired. Please investigate.

**Alert Details:**
- Monitor ID: ${trigger.id || 'Unknown'}
- Monitor Name: ${payload.alert_title || 'Unknown'}
- Status: ${payload.alert_status || 'Triggered'}

**Message:**
${payload.body || payload.message || 'No message'}

**Tags:**
${Array.isArray(payload.tags) ? payload.tags.join(', ') : payload.tags || 'None'}

Please investigate and provide findings.`
  }
  return `Investigation requested: ${JSON.stringify(trigger)}`
}
```

---

### Phase 4: Integrations (Days 5-7)

#### Step 4.1: GitHub OAuth Callback

```typescript
// src/app/api/auth/callback/github/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const state = searchParams.get('state')

  const cookieStore = await cookies()
  const storedState = cookieStore.get('github_oauth_state')?.value

  if (state !== storedState) {
    return NextResponse.redirect(new URL('/onboarding/connect?error=invalid_state', request.url))
  }

  cookieStore.delete('github_oauth_state')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.redirect(new URL('/login', request.url))

    const orgId = user.user_metadata.org_id

    if (installationId) {
      // Store installation ID securely
      await supabaseAdmin.rpc('store_integration_secret', {
        p_org_id: orgId,
        p_provider: 'github',
        p_secret_name: 'installation_id',
        p_secret_value: installationId,
      })

      // Update integration status
      await supabaseAdmin.from('integrations').upsert({
        org_id: orgId,
        provider: 'github',
        status: 'connected',
        metadata: { installation_id: installationId },
        connected_at: new Date().toISOString(),
      }, { onConflict: 'org_id,provider' })

      return NextResponse.redirect(new URL('/onboarding/connect?github=connected', request.url))
    }

    return NextResponse.redirect(new URL('/onboarding/connect?error=no_installation', request.url))
  } catch (error) {
    console.error('GitHub OAuth error:', error)
    return NextResponse.redirect(new URL('/onboarding/connect?error=github_failed', request.url))
  }
}
```

#### Step 4.2: Slack OAuth Callback

```typescript
// src/app/api/auth/callback/slack/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(new URL(`/onboarding/connect?error=slack_denied`, request.url))
  }

  const cookieStore = await cookies()
  const storedState = cookieStore.get('slack_oauth_state')?.value

  if (state !== storedState) {
    return NextResponse.redirect(new URL('/onboarding/connect?error=invalid_state', request.url))
  }

  cookieStore.delete('slack_oauth_state')

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return NextResponse.redirect(new URL('/login', request.url))

    const orgId = user.user_metadata.org_id

    // Exchange code for token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code: code!,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/slack`,
      }),
    })

    const data = await tokenResponse.json()

    if (!data.ok) throw new Error(data.error)

    // Store bot token
    await supabaseAdmin.rpc('store_integration_secret', {
      p_org_id: orgId,
      p_provider: 'slack',
      p_secret_name: 'bot_token',
      p_secret_value: data.access_token,
    })

    if (data.incoming_webhook?.channel_id) {
      await supabaseAdmin.rpc('store_integration_secret', {
        p_org_id: orgId,
        p_provider: 'slack',
        p_secret_name: 'channel_id',
        p_secret_value: data.incoming_webhook.channel_id,
      })
    }

    await supabaseAdmin.from('integrations').upsert({
      org_id: orgId,
      provider: 'slack',
      status: 'connected',
      metadata: {
        team_name: data.team?.name,
        channel_name: data.incoming_webhook?.channel,
      },
      connected_at: new Date().toISOString(),
    }, { onConflict: 'org_id,provider' })

    return NextResponse.redirect(new URL('/onboarding/connect?slack=connected', request.url))
  } catch (error) {
    console.error('Slack OAuth error:', error)
    return NextResponse.redirect(new URL('/onboarding/connect?error=slack_failed', request.url))
  }
}
```

#### Step 4.3: Datadog Webhook Handler

```typescript
// src/app/api/webhooks/datadog/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const payload = JSON.parse(body)

    // Extract org from tags or query param
    const orgSlug = request.nextUrl.searchParams.get('org') || extractOrgFromTags(payload.tags)

    if (!orgSlug) {
      return NextResponse.json({ error: 'Missing org identifier' }, { status: 400 })
    }

    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', orgSlug)
      .single()

    if (!org) {
      return NextResponse.json({ error: 'Unknown organization' }, { status: 404 })
    }

    // Skip recovery alerts
    if (payload.alert_transition === 'Recovered') {
      return NextResponse.json({ status: 'skipped', reason: 'recovery' })
    }

    // Create investigation
    const { data: investigation } = await supabaseAdmin
      .from('investigations')
      .insert({
        org_id: org.id,
        trigger_type: 'datadog_monitor',
        trigger_id: String(payload.alert_id || payload.id),
        trigger_payload: {
          alert_id: payload.alert_id || payload.id,
          alert_title: payload.alert_title || payload.title,
          alert_status: payload.alert_transition,
          message: payload.body,
          tags: payload.tags,
          link: payload.link,
        },
        status: 'queued',
      })
      .select()
      .single()

    // Trigger agent (fire and forget)
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/agent/investigate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ investigationId: investigation?.id, orgId: org.id }),
    }).catch(console.error)

    return NextResponse.json({ status: 'queued', investigation_id: investigation?.id })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}

function extractOrgFromTags(tags?: string | string[]): string | null {
  const tagArray = Array.isArray(tags) ? tags : tags?.split(',') || []
  const orgTag = tagArray.find((t) => t.startsWith('sre_agent_org:'))
  return orgTag?.split(':')[1] || null
}
```

#### Step 4.4: Agent API Route

```typescript
// src/app/api/agent/investigate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { runInvestigation } from '@/lib/agent/graph'
import type { InvestigationContext } from '@/lib/agent/types'

export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const { investigationId, orgId } = await request.json()

    if (!investigationId || !orgId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: investigation } = await supabaseAdmin
      .from('investigations')
      .select('*')
      .eq('id', investigationId)
      .single()

    if (!investigation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await supabaseAdmin
      .from('investigations')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', investigationId)

    // Load credentials
    const credentials = await loadCredentials(orgId)

    const context: InvestigationContext = {
      investigationId,
      orgId,
      trigger: {
        type: investigation.trigger_type as any,
        id: investigation.trigger_id || undefined,
        payload: investigation.trigger_payload || {},
      },
      credentials,
    }

    const result = await runInvestigation(context)

    await supabaseAdmin
      .from('investigations')
      .update({
        status: 'completed',
        summary: result.summary,
        findings: result.findings,
        suggested_actions: result.suggestedActions,
        confidence_score: result.confidence,
        completed_at: new Date().toISOString(),
        duration_ms: result.durationMs,
      })
      .eq('id', investigationId)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Investigation failed:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

async function loadCredentials(orgId: string) {
  const credentials: InvestigationContext['credentials'] = {}

  const ddApiKey = await supabaseAdmin.rpc('get_integration_secret', {
    p_org_id: orgId, p_provider: 'datadog', p_secret_name: 'api_key',
  })
  const ddAppKey = await supabaseAdmin.rpc('get_integration_secret', {
    p_org_id: orgId, p_provider: 'datadog', p_secret_name: 'app_key',
  })

  if (ddApiKey.data && ddAppKey.data) {
    credentials.datadog = {
      apiKey: ddApiKey.data,
      appKey: ddAppKey.data,
      site: 'datadoghq.com',
    }
  }

  const ghInstallationId = await supabaseAdmin.rpc('get_integration_secret', {
    p_org_id: orgId, p_provider: 'github', p_secret_name: 'installation_id',
  })

  if (ghInstallationId.data) {
    credentials.github = {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_PRIVATE_KEY!,
      installationId: parseInt(ghInstallationId.data),
    }
  }

  const slackToken = await supabaseAdmin.rpc('get_integration_secret', {
    p_org_id: orgId, p_provider: 'slack', p_secret_name: 'bot_token',
  })
  const slackChannel = await supabaseAdmin.rpc('get_integration_secret', {
    p_org_id: orgId, p_provider: 'slack', p_secret_name: 'channel_id',
  })

  if (slackToken.data && slackChannel.data) {
    credentials.slack = {
      botToken: slackToken.data,
      channelId: slackChannel.data,
    }
  }

  return credentials
}
```

---

### Phase 5: Frontend (Days 7-10)

#### Step 5.1: Tailwind Config (Linear-style dark theme)

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(0 0% 3.9%)',
        foreground: 'hsl(0 0% 98%)',
        card: { DEFAULT: 'hsl(0 0% 3.9%)', foreground: 'hsl(0 0% 98%)' },
        popover: { DEFAULT: 'hsl(0 0% 3.9%)', foreground: 'hsl(0 0% 98%)' },
        primary: { DEFAULT: 'hsl(217.2 91.2% 59.8%)', foreground: 'hsl(0 0% 100%)' },
        muted: { DEFAULT: 'hsl(0 0% 14.9%)', foreground: 'hsl(0 0% 63.9%)' },
        border: 'hsl(0 0% 14.9%)',
        input: 'hsl(0 0% 14.9%)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
```

#### Step 5.2: Onboarding Store

```typescript
// src/lib/stores/onboarding.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  currentStep: number
  integrations: { github: boolean; slack: boolean; datadog: boolean }
  setIntegration: (provider: 'github' | 'slack' | 'datadog', connected: boolean) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      integrations: { github: false, slack: false, datadog: false },
      setIntegration: (provider, connected) =>
        set({ integrations: { ...get().integrations, [provider]: connected } }),
      nextStep: () => set({ currentStep: get().currentStep + 1 }),
      prevStep: () => set({ currentStep: Math.max(0, get().currentStep - 1) }),
      reset: () => set({ currentStep: 0, integrations: { github: false, slack: false, datadog: false } }),
    }),
    { name: 'onboarding-storage' }
  )
)
```

#### Step 5.3: Integration Card Component

```typescript
// src/components/onboarding/integration-card.tsx
'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react'

type Status = 'disconnected' | 'connecting' | 'connected' | 'error'

interface IntegrationCardProps {
  name: string
  icon: React.ReactNode
  description: string
  status: Status
  connectedAccount?: string
  onConnect: () => void
  onDisconnect?: () => void
}

export function IntegrationCard({
  name, icon, description, status, connectedAccount, onConnect, onDisconnect
}: IntegrationCardProps) {
  return (
    <Card className="p-4 border-border bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{name}</h3>
            {status === 'connected' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {status === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === 'connected' ? connectedAccount : description}
          </p>
        </div>
        <div>
          {status === 'disconnected' && (
            <Button onClick={onConnect}>Connect</Button>
          )}
          {status === 'connecting' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting
            </Button>
          )}
          {status === 'connected' && onDisconnect && (
            <Button variant="outline" onClick={onDisconnect}>Disconnect</Button>
          )}
        </div>
      </div>
    </Card>
  )
}
```

#### Step 5.4: Connect Page

```typescript
// src/app/(onboarding)/connect/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { IntegrationCard } from '@/components/onboarding/integration-card'
import { useOnboardingStore } from '@/lib/stores/onboarding'
import { Github, MessageSquare, Activity } from 'lucide-react'

export default function ConnectPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { integrations, setIntegration, nextStep } = useOnboardingStore()
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('github') === 'connected') setIntegration('github', true)
    if (searchParams.get('slack') === 'connected') setIntegration('slack', true)
  }, [searchParams, setIntegration])

  const handleGitHubConnect = async () => {
    setLoading('github')
    const res = await fetch('/api/integrations/github/install', { method: 'POST' })
    const { url } = await res.json()
    window.location.href = url
  }

  const handleSlackConnect = async () => {
    setLoading('slack')
    const res = await fetch('/api/integrations/slack/install', { method: 'POST' })
    const { url } = await res.json()
    window.location.href = url
  }

  const handleContinue = () => {
    nextStep()
    router.push('/onboarding/setup')
  }

  const canContinue = integrations.github || integrations.slack || integrations.datadog

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="space-y-2 mb-8">
        <h1 className="text-2xl font-bold">Connect your tools</h1>
        <p className="text-muted-foreground">
          Connect at least one integration to get started
        </p>
      </div>

      <div className="space-y-4">
        <IntegrationCard
          name="GitHub"
          icon={<Github className="h-6 w-6" />}
          description="Track deployments and code changes"
          status={integrations.github ? 'connected' : loading === 'github' ? 'connecting' : 'disconnected'}
          connectedAccount="Connected"
          onConnect={handleGitHubConnect}
        />

        <IntegrationCard
          name="Slack"
          icon={<MessageSquare className="h-6 w-6" />}
          description="Receive investigation results"
          status={integrations.slack ? 'connected' : loading === 'slack' ? 'connecting' : 'disconnected'}
          connectedAccount="Connected"
          onConnect={handleSlackConnect}
        />

        <IntegrationCard
          name="Datadog"
          icon={<Activity className="h-6 w-6" />}
          description="Query metrics and logs"
          status={integrations.datadog ? 'connected' : 'disconnected'}
          connectedAccount="Connected"
          onConnect={() => router.push('/onboarding/connect/datadog')}
        />
      </div>

      <div className="mt-8 flex justify-end">
        <Button onClick={handleContinue} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  )
}
```

---

## Environment Variables

```bash
# .env.local

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# GitHub App
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-app-name
GITHUB_CLIENT_ID=Iv1.xxx
GITHUB_CLIENT_SECRET=xxx
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Slack App
SLACK_CLIENT_ID=123.456
SLACK_CLIENT_SECRET=xxx
SLACK_SIGNING_SECRET=xxx

# LangSmith
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=ls_xxx
LANGCHAIN_PROJECT=sre-agent

# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
```

---

## Deployment Guide

### Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Supabase Setup

1. Create project at supabase.com
2. Run SQL schema in SQL Editor
3. Enable Google OAuth in Authentication settings
4. Add site URL to allowed redirects

### GitHub App Setup

1. Create GitHub App at github.com/settings/apps
2. Set callback URL: `https://your-domain.com/api/auth/callback/github`
3. Generate and download private key
4. Request permissions: `contents:read`, `deployments:read`, `metadata:read`

### Slack App Setup

1. Create app at api.slack.com/apps
2. Add OAuth scopes: `chat:write`, `channels:read`, `incoming-webhook`
3. Set redirect URL: `https://your-domain.com/api/auth/callback/slack`
4. Install to workspace

### Datadog Webhook Setup

Give users this URL format:

```
https://your-domain.com/api/webhooks/datadog?org=<org-slug>
```

---

## Summary

This document provides everything needed to build the AI SRE Agent MVP:

| Phase | Focus        | Deliverables                               |
| ----- | ------------ | ------------------------------------------ |
| 1     | Foundation   | Next.js project, Supabase auth, middleware |
| 2     | Database     | Schema, RLS policies, vault functions      |
| 3     | Agent        | LangGraph, Datadog/GitHub/Slack tools      |
| 4     | Integrations | OAuth flows, webhook handlers              |
| 5     | Frontend     | Onboarding, dashboard, Linear-style UI     |

**Build one step at a time. Ship something phenomenal.**
