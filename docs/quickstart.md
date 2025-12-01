# AI SRE Agent MVP — Quick Start Checklist

## Pre-requisites

* [ ] Node.js 18+ installed
* [ ] Datadog account (free trial)
* [ ] GitHub account
* [ ] Slack workspace (admin access)
* [ ] Supabase account
* [ ] Vercel account
* [ ] Anthropic API key

---

## Phase 1: Setup (Day 1)

### 1.1 Create Accounts & Get Credentials

* [ ] **Supabase**
  * Create project at https://supabase.com/dashboard
  * Note: Project URL, Anon Key, Service Role Key
* [ ] **GitHub App**
  * Create at https://github.com/settings/apps/new
  * App name: `your-company-sre-agent`
  * Homepage URL: `https://your-domain.com`
  * Callback URL: `https://your-domain.com/api/auth/callback/github`
  * Setup URL: `https://your-domain.com/onboarding/connect`
  * Webhook: Disable (we'll use API only)
  * Permissions:
    * Repository: Contents (Read), Deployments (Read), Metadata (Read)
    * Organization: Members (Read)
  * Generate private key (download .pem file)
  * Note: App ID, Client ID, Client Secret
* [ ] **Slack App**
  * Create at https://api.slack.com/apps
  * Add OAuth scopes: `chat:write`, `chat:write.public`, `channels:read`, `incoming-webhook`
  * Set redirect URL: `https://your-domain.com/api/auth/callback/slack`
  * Note: Client ID, Client Secret, Signing Secret
* [ ] **Anthropic**
  * Get API key at https://console.anthropic.com
* [ ] **LangSmith**
  * Sign up at https://smith.langchain.com
  * Create API key

### 1.2 Initialize Project

```bash
# Create Next.js project
npx create-next-app@latest sre-agent --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd sre-agent

# Install shadcn/ui
npx shadcn-ui@latest init

# Add components
npx shadcn-ui@latest add button card input label toast dialog form select checkbox badge avatar dropdown-menu skeleton tabs separator alert sonner command

# Install dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install @langchain/langgraph @langchain/anthropic @langchain/core langsmith
npm install datadog-api-client @slack/web-api @octokit/rest @octokit/auth-app
npm install zustand react-hook-form @hookform/resolvers zod
npm install framer-motion lucide-react
```

### 1.3 Create .env.local

```bash
# Copy this and fill in your values
cat > .env.local << 'EOF'
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_PRIVATE_KEY=

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=
LANGCHAIN_PROJECT=sre-agent

ANTHROPIC_API_KEY=
EOF
```

### 1.4 Setup Supabase Database

* [ ] Go to Supabase SQL Editor
* [ ] Copy SQL from PRODUCT_SPEC.md Phase 2
* [ ] Run the SQL
* [ ] Verify tables created in Table Editor

---

## Phase 2: Core Development (Days 2-5)

### 2.1 File Structure

* [ ] Create directory structure as shown in PRODUCT_SPEC.md
* [ ] Create Supabase client files (`lib/supabase/`)
* [ ] Create middleware.ts

### 2.2 Agent Development

* [ ] Create agent types (`lib/agent/types.ts`)
* [ ] Create Datadog tools (`lib/agent/tools/datadog.ts`)
* [ ] Create GitHub tools (`lib/agent/tools/github.ts`)
* [ ] Create Slack tools (`lib/agent/tools/slack.ts`)
* [ ] Create LangGraph agent (`lib/agent/graph.ts`)

### 2.3 API Routes

* [ ] GitHub OAuth callback (`api/auth/callback/github/route.ts`)
* [ ] Slack OAuth callback (`api/auth/callback/slack/route.ts`)
* [ ] Datadog webhook (`api/webhooks/datadog/route.ts`)
* [ ] Agent investigate endpoint (`api/agent/investigate/route.ts`)

---

## Phase 3: Frontend (Days 6-8)

### 3.1 Onboarding

* [ ] Create onboarding layout
* [ ] Create welcome page (role selection)
* [ ] Create connect page (integrations)
* [ ] Create setup page (first config)
* [ ] Create integration card component
* [ ] Create stepper component
* [ ] Create Datadog API key form

### 3.2 Dashboard

* [ ] Create dashboard layout with sidebar
* [ ] Create investigations list page
* [ ] Create investigation detail page
* [ ] Create settings/integrations page

---

## Phase 4: Testing (Days 9-10)

### 4.1 Local Testing

* [ ] Test auth flow (signup/login)
* [ ] Test GitHub OAuth
* [ ] Test Slack OAuth
* [ ] Test Datadog credentials save
* [ ] Test webhook reception
* [ ] Test agent investigation

### 4.2 Test Environment

* [ ] Setup local K8s (minikube/kind)
* [ ] Deploy test app (Storedog or Online Boutique)
* [ ] Configure Datadog agent
* [ ] Create test monitors
* [ ] Trigger test alerts

---

## Phase 5: Deployment

### 5.1 Vercel

* [ ] Push to GitHub
* [ ] Import in Vercel
* [ ] Add all environment variables
* [ ] Deploy

### 5.2 Update OAuth Redirect URLs

* [ ] Update GitHub App callback URL
* [ ] Update Slack App redirect URL
* [ ] Update Supabase allowed redirects

### 5.3 Final Testing

* [ ] Test full flow in production
* [ ] Verify LangSmith traces
* [ ] Verify Slack messages

---

## Post-Launch

* [ ] Monitor LangSmith for agent performance
* [ ] Review user feedback
* [ ] Track investigation accuracy
* [ ] Iterate on agent prompts

---

## Key Files Reference

| File                                     | Purpose                     |
| ---------------------------------------- | --------------------------- |
| `src/middleware.ts`                      | Auth protection             |
| `src/lib/supabase/server.ts`             | Server-side Supabase client |
| `src/lib/agent/graph.ts`                 | LangGraph agent definition  |
| `src/lib/agent/tools/datadog.ts`         | Datadog API tools           |
| `src/app/api/webhooks/datadog/route.ts`  | Webhook handler             |
| `src/app/api/agent/investigate/route.ts` | Agent runner                |
| `src/app/(onboarding)/connect/page.tsx`  | Integration setup           |

---

## Useful Commands

```bash
# Development
npm run dev

# Type generation from Supabase
npx supabase gen types typescript --linked > src/types/database.ts

# Test webhook locally
curl -X POST http://localhost:3000/api/webhooks/datadog?org=your-org \
  -H "Content-Type: application/json" \
  -d '{"alert_id": 123, "alert_title": "Test Alert", "alert_transition": "Triggered"}'

# View LangSmith traces
open https://smith.langchain.com
```

---

## Support Resources

* [Supabase Docs](https://supabase.com/docs)
* [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
* [Datadog API Docs](https://docs.datadoghq.com/api/)
* [Slack API Docs](https://api.slack.com/)
* [shadcn/ui Docs](https://ui.shadcn.com/)
