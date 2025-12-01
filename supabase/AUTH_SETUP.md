# Supabase Authentication Setup Guide

## Overview

This guide covers setting up all authentication methods for the SRE Agent MVP:
- ✅ Google OAuth
- ✅ GitHub OAuth  
- ✅ Email/Password with verification

## 1. Google OAuth Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Navigate to **APIs & Services** → **Credentials**

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type
3. Fill in required fields:
   - App name: `SRE Agent`
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - `email`
   - `profile`
   - `openid`
5. Add test users (for development)

### Step 3: Create OAuth Credentials

1. Go to **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Name: `SRE Agent - Supabase`
4. **Authorized JavaScript origins**:
   ```
   http://localhost:3000
   https://your-app.vercel.app
   ```
5. **Authorized redirect URIs**:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   http://localhost:54321/auth/v1/callback  (for local dev)
   ```
6. Copy **Client ID** and **Client Secret**

### Step 4: Configure in Supabase

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Find **Google** and enable it
3. Paste your Client ID and Client Secret
4. Save

### Step 5: Implement in Code

```typescript
// lib/supabase/auth.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  
  if (error) throw error
  return data
}
```

---

## 2. GitHub OAuth Setup

### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - Application name: `SRE Agent`
   - Homepage URL: `https://your-app.vercel.app`
   - Authorization callback URL: `https://<your-project-ref>.supabase.co/auth/v1/callback`
4. Click **Register application**
5. Copy **Client ID**
6. Generate and copy **Client Secret**

### Step 2: Configure in Supabase

1. Go to Supabase Dashboard → **Authentication** → **Providers**
2. Find **GitHub** and enable it
3. Paste your Client ID and Client Secret
4. Save

### Step 3: Implement in Code

```typescript
export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email',
    },
  })
  
  if (error) throw error
  return data
}
```

---

## 3. Email/Password Setup

### Step 1: Configure Email Settings

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Customize templates:
   - **Confirm signup**: Email sent when user signs up
   - **Reset password**: Email sent for password reset
   - **Magic link**: Email for passwordless login

### Step 2: Configure Email Provider (Production)

For production, configure a custom SMTP provider:

1. Go to **Authentication** → **Email** → **Enable Custom SMTP**
2. Recommended providers:
   - [Resend](https://resend.com) (easiest)
   - [SendGrid](https://sendgrid.com)
   - [Mailgun](https://mailgun.com)

Example with Resend:
```
SMTP Host: smtp.resend.com
SMTP Port: 465
SMTP User: resend
SMTP Password: re_xxxxxxxxx (your API key)
Sender email: noreply@your-domain.com
```

### Step 3: Configure Auth Settings

1. Go to **Authentication** → **Settings**
2. Configure:
   - **Enable email confirmations**: ON (for production)
   - **Secure email change**: ON
   - **Secure password change**: ON
   - **Minimum password length**: 8
   - **JWT expiry**: 3600 (1 hour)

### Step 4: Implement in Code

```typescript
// Sign up with email/password
export async function signUpWithEmail(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  
  if (error) throw error
  return data
}

// Sign in with email/password
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) throw error
  return data
}

// Reset password
export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  
  if (error) throw error
  return data
}

// Update password (after reset)
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  })
  
  if (error) throw error
  return data
}
```

---

## 4. Auth Callback Handler (Next.js)

Create the auth callback route to handle OAuth redirects:

```typescript
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to error page if something went wrong
  return NextResponse.redirect(`${origin}/auth/error`)
}
```

---

## 5. Middleware for Protected Routes

```typescript
// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
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
            request,
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

  // Redirect logged-in users away from auth pages
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/signup', '/onboarding/:path*'],
}
```

---

## 6. Identity Linking

Supabase automatically links identities with the same email. This means:
- User signs up with email/password as `john@example.com`
- User later signs in with Google using `john@example.com`
- Both identities are linked to the same user account

### Manual Identity Linking

```typescript
// Link additional provider to existing account
export async function linkGitHub() {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  
  if (error) throw error
  return data
}

// Unlink an identity
export async function unlinkIdentity(identityId: string) {
  const { data, error } = await supabase.auth.unlinkIdentity({
    id: identityId,
  })
  
  if (error) throw error
  return data
}

// Get user's linked identities
export async function getLinkedIdentities() {
  const { data: { user } } = await supabase.auth.getUser()
  return user?.identities || []
}
```

---

## 7. Environment Variables

Add these to your `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL (for redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production (Vercel), add the same variables with production URLs.

---

## 8. Testing Checklist

- [ ] Google OAuth: Sign up, sign in, sign out
- [ ] GitHub OAuth: Sign up, sign in, sign out
- [ ] Email/Password: Sign up, verify email, sign in, sign out
- [ ] Password Reset: Request reset, receive email, update password
- [ ] Identity Linking: Sign up with email, link Google account
- [ ] Protected Routes: Unauthenticated users redirected to login
- [ ] Auth Callback: OAuth redirects work correctly
- [ ] Session Refresh: Long-running sessions stay authenticated

---

## Troubleshooting

### "Invalid redirect URL"
- Check that your redirect URL exactly matches what's configured in Google/GitHub
- Include both `http://localhost:3000` and production URL

### "Email not confirmed"
- Check spam folder
- For development, disable email confirmation in Supabase settings
- For production, configure custom SMTP

### "Invalid JWT"
- Session may have expired
- Call `supabase.auth.refreshSession()` to refresh

### OAuth popup blocked
- Ensure `signInWithOAuth` is called from a user interaction (click)
- Don't call it on page load
