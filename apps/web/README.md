# Scout Web Dashboard

Next.js frontend for the Scout AI SRE Investigation Agent.

## Features

- User authentication (Supabase Auth)
- Integration management (Datadog, GitHub, Slack)
- Investigation history and results
- Real-time investigation progress

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

## Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GitHub App
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
GITHUB_CLIENT_ID=Iv1.xxx
GITHUB_CLIENT_SECRET=xxx

# Slack App
SLACK_CLIENT_ID=xxx.xxx
SLACK_CLIENT_SECRET=xxx
SLACK_SIGNING_SECRET=xxx

# Agent API (development)
AGENT_API_URL=http://127.0.0.1:2024
```

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── (auth)/          # Auth pages (login, signup, etc.)
│   ├── api/             # API routes
│   ├── dashboard/       # Dashboard pages
│   └── onboarding/      # Onboarding flow
├── components/          # React components
│   ├── ui/              # shadcn/ui components
│   ├── dashboard/       # Dashboard-specific components
│   ├── integrations/    # Integration settings components
│   └── shared/          # Shared components
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and configs
│   ├── supabase/        # Supabase client
│   └── utils/           # Helper utilities
└── types/               # TypeScript types
```

## Deployment

Deployed automatically to Vercel on push to `main` branch.

See `vercel.json` for configuration.
