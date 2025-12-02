import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface UserOrgResult {
  orgId: string
  userId: string
}

export interface AuthError {
  error: string
  status: number
}

/**
 * Gets the authenticated user's organization ID.
 * Returns either the org info or an error response.
 */
export async function getUserOrg(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<UserOrgResult | AuthError> {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_org_id) {
    return { error: 'No organization selected', status: 400 }
  }

  return { orgId: profile.current_org_id, userId: user.id }
}

/**
 * Helper to check auth and return error response if needed.
 * Usage: const auth = await requireAuth(supabase)
 *        if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
 */
export async function requireAuth(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<UserOrgResult | AuthError> {
  return getUserOrg(supabase)
}

