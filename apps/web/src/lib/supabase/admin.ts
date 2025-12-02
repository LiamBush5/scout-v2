import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client for service-level operations.
 * This should only be used in server-side code.
 *
 * Returns a new client instance each time to avoid shared state issues.
 */
export function getSupabaseAdmin() {
  return createClient(
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
