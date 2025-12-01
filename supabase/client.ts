// src/lib/supabase/client.ts
/**
 * Supabase Client Setup for Next.js 14 (App Router)
 * 
 * Three clients for different contexts:
 * 1. Browser Client - For client components
 * 2. Server Client - For server components and route handlers
 * 3. Admin Client - For server-side operations bypassing RLS
 */

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// =============================================================================
// BROWSER CLIENT (Client Components)
// =============================================================================

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// =============================================================================
// SERVER CLIENT (Server Components, Route Handlers, Server Actions)
// =============================================================================

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
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
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  )
}

// =============================================================================
// ADMIN CLIENT (Server-side only, bypasses RLS)
// =============================================================================

export function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { Database }
