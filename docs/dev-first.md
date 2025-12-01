# Building a Developer-First SaaS Onboarding Experience

**A minimal, fast onboarding flow for software engineers and product managers can achieve time-to-value under 5 minutes by combining progressive disclosure, smart OAuth patterns, and the Linear-style aesthetic.** Research across Cursor, Linear, Vercel, and other developer tools reveals that 80% of users who don't complete onboarding disappear after day one, while optimized flows can boost activation from 15% to 75%. The key principles: one input per screen, smart defaults everywhere, and embedding the "aha moment" directly within the onboarding flow itself.

This guide provides specific code examples, component structures, and design recommendations for implementing a Next.js + shadcn/ui onboarding system connecting Datadog, Slack, and GitHub.

---

## The Linear-style aesthetic that developers trust

Cursor and Linear have established a recognizable design language that signals "built for developers":  **near-black backgrounds (#0a0a0a)** , the  **Inter font family** , generous whitespace, and subtle micro-animations. This aesthetic isn't merely visual preference—it reduces eye strain during long sessions and mirrors the coding environments developers already inhabit.

**Core visual specifications:**

* Background: `hsl(0, 0%, 3.9%)` (near-black)
* Foreground: `hsl(0, 0%, 98%)` (almost white)
* Primary accent: `hsl(217, 91%, 60%)` (blue, like Linear)
* Border: `hsl(0, 0%, 14%)` (subtle definition)
* Font: Inter at 14-16px base, weights 400/500/600

**Tailwind configuration for the dark mode palette:**

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...fontFamily.sans],
        mono: ["JetBrains Mono", ...fontFamily.mono],
      },
      colors: {
        background: "hsl(0, 0%, 3.9%)",
        foreground: "hsl(0, 0%, 98%)",
        muted: { DEFAULT: "hsl(0, 0%, 14%)", foreground: "hsl(0, 0%, 63%)" },
        primary: { DEFAULT: "hsl(217, 91%, 60%)", foreground: "hsl(0, 0%, 100%)" },
        border: "hsl(0, 0%, 14%)",
      },
    },
  },
}
```

Linear's magic comes from **keyboard-first interaction** (⌘K command palette), **one input per screen** to reduce cognitive load, and animations under 200ms that feel instant. Avoid flashy transitions—use Framer Motion with `duration: 0.15` for transforms and `0.2` for opacity changes.

---

## Optimal onboarding structure: three steps, under 5 minutes

Research consistently shows that  **3 steps is ideal** ; each additional step reduces completion by 10-15%. Hotjar documented a case where reducing from 5+ screens to 3 improved activation from 15% to 75%. For an SRE monitoring agent, the flow should be:

| Step                  | Purpose          | Required Fields                                | Time Target |
| --------------------- | ---------------- | ---------------------------------------------- | ----------- |
| **1. Role & Context** | Personalization  | Role selector, company size                    | 30 seconds  |
| **2. Integrations**   | Core value setup | GitHub, Slack, Datadog connections             | 2-3 minutes |
| **3. First Win**      | Activation       | Select repos to monitor, configure first alert | 1-2 minutes |

**The critical insight:** Include the activation action (configuring the first alert) within onboarding itself. Don't dump users on an empty dashboard hoping they'll figure it out— **40-60% won't** .

**Recommended Next.js route structure:**

```
app/
├── (onboarding)/
│   ├── layout.tsx          # Shared progress indicator
│   ├── welcome/page.tsx    # Step 1: Role selection
│   ├── connect/page.tsx    # Step 2: OAuth integrations
│   └── setup/page.tsx      # Step 3: First configuration
├── api/auth/
│   └── callback/[provider]/route.ts  # OAuth handlers
└── middleware.ts           # Redirect incomplete onboarding
```

---

## Multi-OAuth flow for Datadog, Slack, and GitHub

When connecting multiple services,  **sequence matters** : start with the service that delivers the most immediate value, then add complementary integrations. For SRE monitoring:

1. **GitHub first** (primary source of deployment events)
2. **Slack second** (enables immediate alert delivery)
3. **Datadog optional** (enriches context but isn't required for core value)

 **Use GitHub Apps over OAuth Apps** —GitHub explicitly recommends this. GitHub Apps offer fine-grained permissions (users select specific repos), short-lived tokens (1 hour with refresh), and persistence independent of the installing user. For SRE monitoring, request: `contents:read`, `metadata:read`, `pull_requests:read`, `deployments:read`, `checks:read`.

**Slack OAuth v2** requires bot scopes: `chat:write`, `channels:read`, and optionally `incoming-webhook`. Slack tokens don't expire by default, simplifying token management.

 **Datadog uses API keys, not OAuth** . Guide users to create a scoped Application Key with minimal permissions: `dashboards_read`, `metrics_read`, `monitors_read`. Provide a direct link to their Datadog settings page.

 **Always use redirect mode for OAuth** , not popups. Auth0's documentation explicitly states "only use popup mode if you must"—popups fail on mobile, trigger blockers, and create unreliable cross-window communication. Maintain state using the OAuth `state` parameter:

```typescript
// Generate state before redirect
const state = crypto.randomUUID()
cookies().set('oauth_state', state, { httpOnly: true, maxAge: 600 })

// Verify on callback
const storedState = cookies().get('oauth_state')?.value
if (state !== storedState) throw new Error('Invalid state')
```

---

## Integration card component with connection states

Each integration needs four visual states: disconnected, connecting, connected, and error. Here's a shadcn/ui-based implementation:

```typescript
// components/onboarding/integration-card.tsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CheckCircle2, Loader2, AlertCircle, Plug } from "lucide-react"

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"

interface IntegrationCardProps {
  name: string
  icon: React.ReactNode
  description: string
  status: ConnectionStatus
  connectedAccount?: string
  onConnect: () => void
  onDisconnect: () => void
  errorMessage?: string
}

export function IntegrationCard({
  name, icon, description, status, connectedAccount,
  onConnect, onDisconnect, errorMessage
}: IntegrationCardProps) {
  return (
    <Card className="p-4 border-border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{name}</h3>
            {status === "connected" && (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
            {status === "error" && (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {status === "connected" ? connectedAccount : description}
          </p>
          {status === "error" && errorMessage && (
            <p className="text-sm text-destructive mt-1">{errorMessage}</p>
          )}
        </div>
        <div>
          {status === "disconnected" && (
            <Button onClick={onConnect}>Connect</Button>
          )}
          {status === "connecting" && (
            <Button disabled>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting
            </Button>
          )}
          {status === "connected" && (
            <Button variant="outline" onClick={onDisconnect}>
              Manage
            </Button>
          )}
          {status === "error" && (
            <Button variant="destructive" onClick={onConnect}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
```

---

## Multi-step form with Zod validation and persistence

Use **Zustand with persist middleware** for localStorage + React Hook Form for per-step validation. This combination handles browser crashes gracefully—users can resume from where they left off:

```typescript
// lib/stores/onboarding.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OnboardingState {
  currentStep: number
  formData: {
    role?: string
    companySize?: string
    integrations: { github?: boolean; slack?: boolean; datadog?: boolean }
    selectedRepos?: string[]
  }
  setFormData: (data: Partial<OnboardingState['formData']>) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      currentStep: 0,
      formData: { integrations: {} },
      setFormData: (data) => set({
        formData: { ...get().formData, ...data }
      }),
      nextStep: () => set({ currentStep: get().currentStep + 1 }),
      prevStep: () => set({ currentStep: get().currentStep - 1 }),
      reset: () => set({ currentStep: 0, formData: { integrations: {} } }),
    }),
    {
      name: 'onboarding-storage',
      partialize: (state) => ({
        currentStep: state.currentStep,
        formData: state.formData
      }),
    }
  )
)
```

**Zod schema for the integrations step:**

```typescript
// lib/validations/onboarding.ts
import { z } from "zod"

export const roleStepSchema = z.object({
  role: z.enum(["engineer", "product", "devops", "other"], {
    required_error: "Please select your role",
  }),
  companySize: z.enum(["1-10", "11-50", "51-200", "201-1000", "1000+"], {
    required_error: "Please select company size",
  }),
})

export const integrationsStepSchema = z.object({
  integrations: z.object({
    github: z.boolean().refine(val => val === true, {
      message: "GitHub connection is required",
    }),
    slack: z.boolean().optional(),
    datadog: z.boolean().optional(),
  }),
})

export const setupStepSchema = z.object({
  selectedRepos: z.array(z.string()).min(1, "Select at least one repository"),
})
```

---

## OAuth callback handling with Server Actions

OAuth callbacks must use API routes (external providers can't call Server Actions), but subsequent state updates work well with Server Actions:

```typescript
// app/api/auth/callback/github/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  // Verify state parameter
  const storedState = cookies().get("oauth_state")?.value
  if (state !== storedState) {
    return NextResponse.redirect(
      new URL("/onboarding/connect?error=invalid_state", request.url)
    )
  }

  try {
    // Exchange code for tokens (GitHub App)
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    )

    const tokens = await tokenResponse.json()

    // Store tokens securely (database, not shown)
    // await saveGitHubTokens(userId, tokens)

    return NextResponse.redirect(
      new URL("/onboarding/connect?github=connected", request.url)
    )
  } catch (error) {
    return NextResponse.redirect(
      new URL("/onboarding/connect?error=github_failed", request.url)
    )
  }
}
```

---

## Progress stepper component

shadcn/ui doesn't include a stepper, but building one follows their patterns:

```typescript
// components/ui/stepper.tsx
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface Step {
  id: string
  title: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <nav className={cn("flex items-center justify-center", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-all",
                index < currentStep && "border-primary bg-primary text-primary-foreground",
                index === currentStep && "border-primary text-primary",
                index > currentStep && "border-muted text-muted-foreground"
              )}
            >
              {index < currentStep ? (
                <Check className="h-5 w-5" />
              ) : (
                index + 1
              )}
            </div>
            <span className={cn(
              "mt-2 text-xs font-medium",
              index <= currentStep ? "text-foreground" : "text-muted-foreground"
            )}>
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "mx-4 h-0.5 w-16 transition-colors",
                index < currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          )}
        </div>
      ))}
    </nav>
  )
}
```

---

## Smart defaults and auto-detection reduce friction

**Less than 5% of users change default settings** (Jared Spool's research). Pre-fill aggressively:

| Detection Method   | What to Pre-fill                 |
| ------------------ | -------------------------------- |
| OAuth profile data | Name, email, avatar, company     |
| Email domain       | Company name, industry guess     |
| Browser locale     | Timezone, language, date format  |
| GitHub org data    | Team name, repo suggestions      |
| IP geolocation     | Country (for compliance options) |

**After GitHub OAuth, auto-detect and suggest:**

```typescript
// Fetch user's repositories and suggest likely candidates
const repos = await octokit.repos.listForAuthenticatedUser({
  sort: "pushed",
  per_page: 10,
})

// Prioritize repos with recent deployments or CI/CD config
const suggestions = repos.data.filter(repo =>
  repo.pushed_at &&
  new Date(repo.pushed_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
).slice(0, 5)
```

---

## Command palette for power users

Include the shadcn Command component (wraps cmdk) for Linear-style navigation. Surface it during onboarding with a tooltip—this signals "built for keyboard users":

```typescript
// components/command-menu.tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Settings, Plug, HelpCircle } from "lucide-react"

export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => router.push("/onboarding/connect")}>
            <Plug className="mr-2 h-4 w-4" />
            Integrations
          </CommandItem>
          <CommandItem onSelect={() => router.push("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </CommandItem>
          <CommandItem onSelect={() => window.open("/docs", "_blank")}>
            <HelpCircle className="mr-2 h-4 w-4" />
            Documentation
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

---

## Error handling with graceful recovery

Connection failures are inevitable. Use **progressive retry** with clear messaging:

```typescript
// hooks/use-retry.ts
export function useRetryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries = 3
) {
  const [attempt, setAttempt] = useState(0)
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const execute = async () => {
    setStatus("loading")

    for (let i = 0; i <= maxRetries; i++) {
      try {
        const result = await operation()
        setStatus("success")
        return result
      } catch (e) {
        setAttempt(i + 1)
        if (i === maxRetries) {
          setStatus("error")
          setError(e instanceof Error ? e.message : "Connection failed")
          throw e
        }
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
      }
    }
  }

  return { execute, status, error, attempt }
}
```

**User-facing error messages** should be actionable:

* ❌ "Error: ERR_TIMEOUT"
* ✅ "We couldn't connect to GitHub. Check that you've granted the necessary permissions, then try again."

---

## Analytics events to track conversion

Track these events to identify and fix drop-off points:

```typescript
// lib/analytics.ts
export const OnboardingEvents = {
  // Flow progression
  ONBOARDING_STARTED: "onboarding_started",
  STEP_VIEWED: "onboarding_step_viewed",
  STEP_COMPLETED: "onboarding_step_completed",
  STEP_SKIPPED: "onboarding_step_skipped",
  ONBOARDING_COMPLETED: "onboarding_completed",
  ONBOARDING_ABANDONED: "onboarding_abandoned",

  // Integrations
  INTEGRATION_STARTED: "integration_started",
  INTEGRATION_COMPLETED: "integration_completed",
  INTEGRATION_FAILED: "integration_failed",

  // Activation
  FIRST_REPO_SELECTED: "first_repo_selected",
  FIRST_ALERT_CONFIGURED: "first_alert_configured",
  AHA_MOMENT_REACHED: "aha_moment_reached",
} as const

// Usage
track(OnboardingEvents.STEP_COMPLETED, {
  step_name: "integrations",
  step_number: 2,
  duration_seconds: 45,
  integrations_connected: ["github", "slack"],
})
```

**Benchmark targets** from Userpilot's 2025 data across 547 companies:

* Onboarding completion rate: **40-60%** (B2B)
* Time to value: **under 7 days** (top performers: 1-2 days)
* Activation rate: **36%+** average, **50%+** for top performers

---

## In-app guidance: tooltips over modals

Developers prefer scannable text over videos. Use tooltips for feature hints and link to documentation for complex topics:

| Content Type           | Approach                     |
| ---------------------- | ---------------------------- |
| Quick hint (<50 words) | Tooltip with icon trigger    |
| Feature explanation    | Expandable inline help       |
| Integration setup      | Link to docs + support chat  |
| API reference          | Direct link to documentation |

**Tooltip best practices:** Keep copy under 150 characters. Appear immediately on trigger, provide clear exit (X or click-outside), and never use tooltips for critical information that users might miss.

For the onboarding checklist pattern, include **one pre-completed item** to leverage the Zeigarnik effect—people remember incomplete tasks better than completed ones, creating motivation to finish.

---

## Conclusion

The most successful developer onboarding flows share a counterintuitive insight:  **they do less, not more** . Linear asks one question per screen. Cursor lets you start coding before creating an account. Vercel auto-detects your framework and deploys with a single click.

For your AI-powered SRE monitoring agent, implement three steps maximum, require only the GitHub integration initially, and ensure users configure their first alert before leaving onboarding. Use the dark-mode Linear aesthetic with Inter typography to signal "built for engineers." Persist state with Zustand to handle browser crashes, and track step completion events to identify where users drop off.

The technical implementation—Next.js App Router with shadcn/ui components, Server Actions for form handling, API routes for OAuth callbacks—creates a foundation that's both maintainable and performant. But the real differentiation comes from the UX decisions: smart defaults that eliminate decisions, progressive disclosure that hides complexity until it's needed, and an activation moment that happens inside the onboarding flow itself.
