# Supabase Setup for SRE Agent MVP

Complete Supabase configuration including multi-tenancy, authentication, Vault, Realtime, and Storage.

## 📁 Files Included

| File | Description |
|------|-------------|
| `setup.sql` | **Run this first!** Complete database schema with RLS, triggers, and functions |
| `AUTH_SETUP.md` | Step-by-step guide for Google, GitHub, and Email/Password auth |
| `src/client.ts` | Supabase client setup for Next.js (browser, server, admin) |
| `src/database.ts` | TypeScript types for all tables and functions |
| `src/realtime.ts` | React hooks for live investigation updates |

---

## 🚀 Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Save your credentials:
   - Project URL: `https://xxx.supabase.co`
   - Anon Key: `eyJ...`
   - Service Role Key: `eyJ...` (keep secret!)

### 2. Run Database Setup

1. Go to **SQL Editor** in Supabase Dashboard
2. Paste the entire contents of `setup.sql`
3. Click **Run**

This creates:
- ✅ 7 tables with proper relationships
- ✅ RLS policies for multi-tenancy
- ✅ Vault functions for secure credential storage
- ✅ Triggers for automatic user/org creation
- ✅ Realtime subscriptions
- ✅ Storage bucket with policies

### 3. Configure Authentication

Follow `AUTH_SETUP.md` to enable:
- Google OAuth
- GitHub OAuth
- Email/Password

### 4. Add Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 5. Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

### 6. Generate Types (Optional but Recommended)

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase gen types typescript --linked > src/types/database.ts
```

---

## 🏗️ Architecture

### Multi-Tenancy with RLS

```
Organizations (root)
    ├── Org Members (user ↔ org relationship)
    ├── Integrations (datadog, github, slack)
    ├── Investigations (core investigation records)
    └── Investigation Events (timeline)

Profiles (user data, linked to current_org_id)
```

All tables use RLS policies that check org membership:

```sql
-- Users can only see data from their organizations
USING (org_id IN (SELECT public.get_user_org_ids()))
```

### Vault for Credentials

Store sensitive API keys encrypted:

```typescript
// Store a secret
await supabase.rpc('store_integration_secret', {
  p_org_id: orgId,
  p_provider: 'datadog',
  p_secret_type: 'api_key',
  p_secret_value: 'dd_xxx'
})

// Retrieve (server-side only!)
const secret = await supabase.rpc('get_integration_secret', {
  p_org_id: orgId,
  p_provider: 'datadog',
  p_secret_type: 'api_key'
})
```

### Realtime Subscriptions

Subscribe to live investigation updates:

```typescript
import { useInvestigationStatus } from '@/lib/supabase/realtime'

function InvestigationPage({ id }) {
  const { investigation, isLoading } = useInvestigationStatus(id)
  
  // UI updates automatically as status changes!
  return <div>Status: {investigation?.status}</div>
}
```

### Storage

Upload files to org-specific folders:

```typescript
// Upload to investigation attachments
const { data, error } = await supabase.storage
  .from('investigation-attachments')
  .upload(`${orgId}/${investigationId}/screenshot.png`, file)
```

---

## 📊 Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant root, contains org settings |
| `org_members` | User-org relationships with roles |
| `profiles` | Extended user info, current org selection |
| `integrations` | Connection status for datadog/github/slack |
| `investigations` | Core investigation records |
| `investigation_events` | Investigation timeline events |
| `webhook_logs` | Audit trail for incoming webhooks |

### Key Functions

| Function | Purpose |
|----------|---------|
| `get_user_org_ids()` | Get all org IDs user belongs to |
| `is_org_member(org_id)` | Check if user is org member |
| `is_org_admin(org_id)` | Check if user is admin/owner |
| `store_integration_secret()` | Save credentials to Vault |
| `get_integration_secret()` | Retrieve credentials from Vault |
| `get_org_credentials()` | Get all credentials for agent |
| `create_investigation()` | Create new investigation record |
| `complete_investigation()` | Update investigation with results |

---

## 🔐 Security Checklist

- [x] RLS enabled on all tables
- [x] Credentials stored in Vault (encrypted at rest)
- [x] Admin-only access for sensitive operations
- [x] User can only access their organizations' data
- [x] Storage policies restrict uploads to org folders
- [x] Triggers use `SECURITY DEFINER` with empty `search_path`

---

## 🧪 Testing

### Test User Signup
1. Sign up with email/password or OAuth
2. Verify profile created automatically
3. Verify organization created automatically
4. Verify integration records created (disconnected)

### Test RLS
```sql
-- In SQL Editor, impersonate a user:
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "user-uuid-here"}';

-- Try to query data
SELECT * FROM investigations;
-- Should only return investigations from user's orgs
```

### Test Realtime
1. Open app in two browser windows
2. Create investigation in one window
3. Verify it appears in the other window automatically

---

## 🔗 Related Files

- `src/lib/supabase/client.ts` - Supabase client setup
- `src/types/database.ts` - TypeScript types
- `src/lib/supabase/realtime.ts` - Realtime hooks
- See also: Agent files in `/agent/` directory
