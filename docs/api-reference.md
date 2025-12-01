# Complete API Reference for AI-Powered SRE Monitoring SaaS

Building an AI-powered SRE monitoring agent requires integrating multiple platforms for monitoring, communication, AI orchestration, and user management. This research covers **every critical API endpoint, authentication method, rate limit, and best practice** across Supabase, Slack, Datadog, LangChain/LangSmith, and additional DevOps integrations. The key finding: most platforms use OAuth 2.0 or API keys with HMAC-SHA256 webhook verification, with rate limits ranging from 60/hour (unauthenticated) to 500,000 events/hour (Datadog), requiring careful multi-tenant quota management.

---

## Supabase: Multi-tenant backend foundation

Supabase provides the complete backend infrastructure for user authentication, database operations, real-time updates, file storage, and secure credential management through a unified API.

### Authentication API endpoints

The Auth API at `https://<project>.supabase.co/auth/v1/` handles all identity operations:

| Operation      | Endpoint                          | Method |
| -------------- | --------------------------------- | ------ |
| Sign up        | `/signup`                         | POST   |
| Password login | `/token?grant_type=password`      | POST   |
| Magic link     | `/magiclink`                      | POST   |
| OAuth redirect | `/authorize`                      | GET    |
| Token refresh  | `/token?grant_type=refresh_token` | POST   |
| Get user       | `/user`                           | GET    |
| Password reset | `/recover`                        | POST   |

**JWT tokens** contain critical claims including `sub` (user UUID), `role` (authenticated/anon), `aal` (authenticator assurance level), and custom `app_metadata` where tenant_id should be stored for optimal RLS performance. Tokens auto-refresh via the SDK's `onAuthStateChange` listener.

```typescript
// Recommended pattern: Store tenant_id in JWT claims
const { data } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password',
  options: { data: { tenant_id: 'org-123' } }
});
```

### Row Level Security for multi-tenancy

The highest-performance RLS pattern extracts tenant_id directly from JWT claims rather than querying lookup tables:

```sql
CREATE POLICY "Tenant isolation"
ON incidents FOR ALL
TO authenticated
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

 **Performance optimization** : Wrap `auth.uid()` calls in `SELECT` for query plan caching, add indexes on tenant_id columns, and use `SECURITY DEFINER` functions for complex lookups.

### PostgREST database API

The REST API at `/rest/v1/<table>` supports full CRUD with powerful filtering:

```typescript
// Complex query with relations and filters
const { data } = await supabase
  .from('incidents')
  .select('id, title, severity, assignee:users(name)')
  .eq('tenant_id', tenantId)
  .in('status', ['active', 'investigating'])
  .order('created_at', { ascending: false })
  .range(0, 49);
```

**Filtering operators** include `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `contains`, `textSearch`, and JSON path queries. Upsert operations use `onConflict` for idempotent writes.

### Real-time subscriptions

Enable Postgres Changes for live incident updates:

```typescript
const channel = supabase
  .channel('tenant-incidents')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'incidents',
    filter: `tenant_id=eq.${tenantId}`
  }, handleChange)
  .subscribe();
```

**Broadcast** enables ephemeral messaging for collaborative features, while **Presence** tracks online users during incident investigation. Both require no database writes, making them ideal for real-time collaboration.

### Storage API for attachments

File operations use `https://<project>.supabase.co/storage/v1`:

```typescript
// Upload incident screenshot
await supabase.storage
  .from('incident-attachments')
  .upload(`tenants/${tenantId}/${filename}`, file, {
    cacheControl: '3600',
    contentType: 'image/png'
  });

// Generate signed URL (1 hour expiry)
const { data } = await supabase.storage
  .from('incident-attachments')
  .createSignedUrl('path/file.png', 3600);
```

 **Limits** : 50MB per file (Free), up to 500GB (Pro+). For files >6MB, use TUS resumable uploads. Storage RLS policies use `storage.foldername(name)` for path-based tenant isolation.

### Edge Functions for webhooks

Deno-based Edge Functions handle incoming webhooks from monitoring platforms:

```typescript
// supabase/functions/datadog-webhook/index.ts
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const payload = await req.json();
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  await supabaseAdmin.from('incidents').insert({
    external_id: payload.incident_id,
    tenant_id: payload.tenant_id,
    severity: payload.severity
  });

  return new Response(JSON.stringify({ received: true }));
});
```

**Deploy without JWT verification** for external webhooks: `supabase functions deploy webhook-handler --no-verify-jwt`. Runtime limits:  **400s wall clock, 2s CPU time, 256MB memory** .

### Vault for API key storage

Store customer credentials (Datadog API keys, Slack tokens) encrypted at rest:

```sql
-- Store encrypted credential
SELECT vault.create_secret(
  'dd-api-key-value',
  'datadog_api_key_tenant_123',
  'Datadog API key for tenant 123'
);

-- Retrieve via security definer function (never expose directly)
CREATE FUNCTION get_tenant_api_key(p_tenant_id UUID, p_service TEXT)
RETURNS TEXT AS $$
BEGIN
  IF auth.jwt()->>'tenant_id' != p_tenant_id::TEXT THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN (SELECT decrypted_secret FROM vault.decrypted_secrets
          WHERE name = p_service || '_' || p_tenant_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Connection limits by tier

| Tier  | Direct Connections | Pool Size | Max Clients |
| ----- | ------------------ | --------- | ----------- |
| Free  | 60                 | 15        | 200         |
| Pro   | 90-120             | 15-30     | 200         |
| Team+ | 160-480            | 50-125    | 300-1500    |

Use **Supavisor transaction mode** (port 6543) for serverless deployments.

---

## Datadog: Monitoring data source

The Datadog API provides programmatic access to metrics, events, monitors, and dashboards for your SRE agent to consume and correlate.

### Authentication

Datadog uses two key types:

* **API Key** (`DD-API-KEY` header): For data submission
* **Application Key** (`DD-APPLICATION-KEY` header): For data retrieval and configuration

```bash
curl -X GET "https://api.datadoghq.com/api/v1/query" \
  -H "DD-API-KEY: ${DD_API_KEY}" \
  -H "DD-APPLICATION-KEY: ${DD_APP_KEY}" \
  -d "query=avg:system.cpu.user{*}"
```

### Key API endpoints

| Endpoint                | Purpose           | Rate Limit |
| ----------------------- | ----------------- | ---------- |
| `GET /api/v1/query`     | Query metric data | 100/hour   |
| `POST /api/v1/series`   | Submit metrics    | No limit   |
| `POST /api/v1/events`   | Submit events     | 500K/hour  |
| `GET /api/v1/events`    | Query events      | 1000/hour  |
| `GET /api/v1/monitor`   | List monitors     | Varies     |
| `GET /api/v2/incidents` | Get incidents     | Varies     |

### Rate limit handling

Response headers provide real-time quota information:

* `X-RateLimit-Limit`: Maximum requests allowed
* `X-RateLimit-Remaining`: Requests remaining
* `X-RateLimit-Reset`: Seconds until reset
* `X-RateLimit-Period`: Window duration

 **Critical limits** : Metric retrieval at  **100/hour** , query_batch at  **300/hour** . Implement exponential backoff for 429 responses and batch operations where possible.

### Webhook configuration

Configure Datadog to send alert notifications to your SRE agent:

```json
{
  "type": "webhooks",
  "name": "SRE Agent Webhook",
  "url": "https://your-project.supabase.co/functions/v1/datadog-webhook",
  "payload": {
    "incident_id": "$ID",
    "title": "$EVENT_TITLE",
    "severity": "$PRIORITY",
    "tags": "$TAGS"
  }
}
```

---

## Slack: Incident communication hub

The Slack API enables rich incident notifications, interactive workflows, and channel management for SRE operations.

### OAuth 2.0 workspace installation

Initiate OAuth at `https://slack.com/oauth/v2/authorize`:

```
https://slack.com/oauth/v2/authorize
  ?client_id=YOUR_CLIENT_ID
  &scope=chat:write,channels:manage,users:read
  &redirect_uri=https://yourapp.com/oauth/callback
```

Exchange the temporary code for tokens at `https://slack.com/api/oauth.v2.access`.

**Bot tokens** (`xoxb-`) are recommended for most operations—they persist after user deactivation. **User tokens** (`xoxp-`) act on behalf of specific users.

### Required scopes for incident management

| Scope               | Purpose                    |
| ------------------- | -------------------------- |
| `chat:write`        | Post messages              |
| `chat:write.public` | Post to any public channel |
| `channels:manage`   | Create/archive channels    |
| `channels:read`     | List channels              |
| `groups:write`      | Manage private channels    |
| `files:write`       | Upload attachments         |
| `commands`          | Slash commands             |
| `reactions:write`   | Add emoji reactions        |

### Messaging API

Send rich incident notifications using Block Kit:

```javascript
const response = await fetch('https://slack.com/api/chat.postMessage', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${botToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel: 'C123456',
    text: '🚨 P1 Incident Alert',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🔴 INC-2024-1234: Database Outage' }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Severity:*\nP1 - Critical' },
          { type: 'mrkdwn', text: '*Status:*\nInvestigating' }
        ]
      },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Acknowledge' },
            action_id: 'ack_incident', style: 'primary' }
        ]
      }
    ]
  })
});
```

**Thread replies** use `thread_ts` parameter. **Message updates** use `chat.update` with the original timestamp.

### Interactive components

Button clicks send payloads to your Request URL.  **Critical** : Acknowledge within 3 seconds with HTTP 200.

```javascript
// Modal dialog for incident details
await fetch('https://slack.com/api/views.open', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    trigger_id: payload.trigger_id,  // Expires in 3 seconds!
    view: {
      type: 'modal',
      callback_id: 'incident_form',
      title: { type: 'plain_text', text: 'Update Incident' },
      submit: { type: 'plain_text', text: 'Save' },
      blocks: [/* form blocks */]
    }
  })
});
```

### Channel management for incidents

```javascript
// Create incident channel
const { channel } = await slack.conversations.create({
  name: 'inc-2024-01-15-db-outage',
  is_private: false
});

// Invite responders
await slack.conversations.invite({
  channel: channel.id,
  users: 'U123456,U789012'
});

// Archive after resolution
await slack.conversations.archive({ channel: channel.id });
```

### Rate limits by tier

| Tier    | Requests/Min   | Example Methods                             |
| ------- | -------------- | ------------------------------------------- |
| Tier 1  | 1+             | `admin.*`                                   |
| Tier 2  | 20+            | `conversations.list`,`conversations.create` |
| Tier 3  | 50+            | `users.list`                                |
| Tier 4  | 100+           | `chat.postEphemeral`                        |
| Special | ~1/sec/channel | `chat.postMessage`                          |

### Request signature verification

```javascript
const crypto = require('crypto');

function verifySlackRequest(signingSecret, timestamp, body, signature) {
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const basestring = `v0:${timestamp}:${body}`;
  const computed = 'v0=' + crypto
    .createHmac('sha256', signingSecret)
    .update(basestring)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(computed),
    Buffer.from(signature)
  );
}
```

---

## LangChain and LangSmith: AI orchestration and observability

LangSmith provides comprehensive tracing, evaluation, and prompt management for your SRE agent.

### Tracing configuration

Enable automatic tracing via environment variables:

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY=ls_...
export LANGSMITH_PROJECT=sre-agent-prod
export LANGCHAIN_CALLBACKS_BACKGROUND=true  # Non-serverless
```

### Manual tracing with @traceable

```python
from langsmith import traceable, Client

client = Client()

@traceable(name="sre_agent", run_type="chain", tags=["production"])
def sre_agent(incident: dict) -> dict:
    diagnosis = diagnose(incident)
    action = remediate(diagnosis)
    return {"diagnosis": diagnosis, "action": action}

@traceable(run_type="llm")
def diagnose(incident):
    return llm.invoke(f"Diagnose: {incident}")

@traceable(run_type="tool")
def remediate(diagnosis):
    return execute_runbook(diagnosis)
```

### LangSmith REST API

Base URL: `https://api.smith.langchain.com`

| Endpoint          | Method | Purpose               |
| ----------------- | ------ | --------------------- |
| `/runs`           | POST   | Create run            |
| `/runs`           | PATCH  | Update run            |
| `/runs/multipart` | POST   | Batch ingest (faster) |

Authentication: `x-api-key: ls_...` header

### Feedback collection

Record operator feedback on agent responses:

```python
client.create_feedback(
    key="operator_feedback",
    score=1,  # 1 = helpful, 0 = not helpful
    trace_id=trace_id,
    comment="Correctly identified root cause"
)
```

### Evaluation API

Test agent quality against datasets:

```python
from langsmith import evaluate

def correctness_evaluator(run, example):
    is_correct = run.outputs.get("action") == example.outputs.get("expected_action")
    return {"key": "correctness", "score": 1 if is_correct else 0}

results = evaluate(
    target=sre_agent,
    data="sre-test-cases",
    evaluators=[correctness_evaluator],
    experiment_prefix="sre-agent-v2"
)
```

### Hub for prompt management

```python
from langsmith import Client

client = Client()

# Push versioned prompt
client.push_prompt(
    "sre-diagnosis-prompt",
    object=prompt_template,
    description="SRE incident diagnosis prompt v2"
)

# Pull for production use
prompt = client.pull_prompt("sre-diagnosis-prompt:latest")
```

### Pricing and limits

| Plan      | Free Traces | Additional |
| --------- | ----------- | ---------- |
| Developer | 5K/month    | $0.50/1K   |
| Plus      | 10K/month   | $0.50/1K   |

Rate limits: ~100K-500K events/hour depending on tier. Extended traces (400-day retention) cost $5.00/1K.

---

## Additional DevOps integrations

### PagerDuty

**Events API v2** (`https://events.pagerduty.com/v2/enqueue`):

```json
{
  "routing_key": "<integration-key>",
  "event_action": "trigger",
  "dedup_key": "unique-alert-id",
  "payload": {
    "summary": "High CPU on prod-server-1",
    "severity": "critical",
    "source": "monitoring-agent"
  }
}
```

OAuth scopes: `incidents.read`, `incidents.write`, `services.read`

Webhook signature: HMAC-SHA256 via `X-PagerDuty-Signature` header

### GitHub

**Deployments API** for correlation with incidents:

```bash
GET /repos/{owner}/{repo}/deployments
POST /repos/{owner}/{repo}/deployments/{id}/statuses
```

 **Authentication** : GitHub App with installation tokens (recommended) or OAuth App

 **Rate limits** : 5,000/hour authenticated, scales with repos for GitHub Apps

Webhook signature: `X-Hub-Signature-256: sha256=<hmac>`

### Jira

**REST API v3** (`https://{site}.atlassian.net/rest/api/3`):

```bash
POST /rest/api/3/issue
{
  "fields": {
    "project": {"key": "INC"},
    "summary": "Incident: Database outage",
    "issuetype": {"name": "Incident"}
  }
}
```

**OAuth 2.0 (3LO)** scopes: `read:jira-work`, `write:jira-work`, `offline_access`

Rate limits: Cost-based budgets, ~100 webhooks per app per tenant

### Linear

**GraphQL API** (`https://api.linear.app/graphql`):

```graphql
mutation {
  issueCreate(input: {
    title: "Incident tracking"
    teamId: "team-uuid"
    priority: 1
  }) {
    success
    issue { id identifier url }
  }
}
```

Rate limits: 1,500 requests/hour for API keys, complexity-based limits

Webhook signature: HMAC-SHA256 via `Linear-Signature` header

---

## Email notifications

### Resend API

```javascript
import { Resend } from 'resend';
const resend = new Resend('re_xxxxxxxxx');

await resend.emails.send({
  from: 'alerts@yourdomain.com',
  to: ['oncall@company.com'],
  subject: 'P1 Incident: Database Outage',
  html: incidentEmailTemplate
});
```

Rate limit: 10,000 requests/second. Supports idempotency keys.

### SendGrid API

```javascript
await sgMail.send({
  to: 'recipient@example.com',
  from: 'alerts@yourdomain.com',
  templateId: 'd-incident-template',
  dynamicTemplateData: { severity: 'P1', title: 'Database Outage' }
});
```

Rate limit: 10,000 requests/second, 20MB max message size.

---

## Comprehensive rate limits summary

| Service             | Endpoint             | Limit        | Period             |
| ------------------- | -------------------- | ------------ | ------------------ |
| Supabase Auth       | Email sent           | Configurable | Per minute         |
| Supabase Management | All                  | 120          | Per minute         |
| Datadog             | Metric retrieval     | 100          | Per hour           |
| Datadog             | Event submission     | 500,000      | Per hour           |
| Slack               | chat.postMessage     | ~1           | Per second/channel |
| Slack               | conversations.create | 20           | Per minute         |
| GitHub (auth)       | All                  | 5,000        | Per hour           |
| PagerDuty           | REST API             | Variable     | See headers        |
| Jira                | All                  | Cost-based   | Per budget         |
| Linear              | All                  | 1,500        | Per hour           |
| LangSmith           | Trace ingestion      | 100K-500K    | Per hour           |

### Multi-tenant rate limit strategy

```javascript
// Redis sliding window for per-tenant limits
const checkTenantLimit = async (tenantId, endpoint) => {
  const key = `ratelimit:${tenantId}:${endpoint}`;
  const now = Date.now();
  const window = 60000; // 1 minute

  await redis.zremrangebyscore(key, 0, now - window);
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  const count = await redis.zcard(key);
  await redis.expire(key, 60);

  return count <= TENANT_LIMITS[endpoint];
};
```

---

## Security best practices

### OAuth token encryption

```javascript
const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';

function encryptToken(token, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}
```

### Webhook signature verification patterns

All platforms use HMAC-SHA256 with constant-time comparison:

| Platform  | Header                  | Format          |
| --------- | ----------------------- | --------------- |
| Slack     | `X-Slack-Signature`     | `v0=<hash>`     |
| GitHub    | `X-Hub-Signature-256`   | `sha256=<hash>` |
| PagerDuty | `X-PagerDuty-Signature` | `<hash>`        |
| Linear    | `Linear-Signature`      | `<hash>`        |

**Always verify timestamps** (5-minute tolerance) to prevent replay attacks.

### Audit logging requirements

Log all authentication events, data access, configuration changes, and API key operations with structured JSON including timestamp, tenant_id, user_id, action, resource, and IP address. Retain logs minimum 1 year for SOC 2 compliance.

### Multi-tenant isolation

PostgreSQL RLS with JWT claims provides the strongest isolation:

```sql
CREATE POLICY tenant_isolation ON all_tables
  USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

Set context per request and test isolation rigorously—any cross-tenant data leak is a critical vulnerability.

---

## Implementation architecture

The recommended architecture connects these integrations through Supabase Edge Functions:

```
Monitoring Sources (Datadog, PagerDuty)
    │ webhooks
    ▼
Supabase Edge Functions (verify signatures, store incidents)
    │
    ├──► Supabase DB (incidents, tenant data with RLS)
    │         │
    │         └──► Real-time subscriptions to frontend
    │
    └──► LangChain Agent (diagnose, correlate)
              │
              ├──► LangSmith (trace all runs)
              │
              └──► Slack (notify, create channels)
                      │
                      └──► Interactive responses back to Edge Functions
```

Customer API credentials live in Supabase Vault, decrypted only in Edge Functions. All webhook handlers verify signatures before processing. Rate limiting happens at the Edge Function layer using Redis or Supabase's built-in capabilities.

This architecture provides complete observability through LangSmith tracing, secure multi-tenant isolation through RLS, and reliable incident communication through Slack's rich messaging APIs—the essential foundation for an AI-powered SRE monitoring agent.
