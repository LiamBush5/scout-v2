import { PostgrestSingleResponse, PostgrestResponse } from '@supabase/supabase-js'

/**
 * Safe query utilities for Supabase that avoid throwing exceptions
 * when queries return unexpected row counts.
 *
 * The default .single() method throws if != 1 row is returned,
 * which can cause unhandled 500 errors. These utilities provide
 * predictable, type-safe alternatives.
 */

export interface SafeSingleResult<T> {
    data: T | null
    error: string | null
    found: boolean
}

export interface SafeQueryResult<T> {
    data: T[]
    error: string | null
    count: number
}

/**
 * Safely gets a single record from a Supabase query result.
 * Unlike .single(), this doesn't throw if 0 or >1 rows are returned.
 *
 * @param result - The PostgrestResponse from a select query
 * @param entityName - Human-readable name for error messages (e.g., "profile", "investigation")
 * @returns SafeSingleResult with either the data or an error message
 *
 * @example
 * const result = await supabase.from('profiles').select('*').eq('id', userId)
 * const { data: profile, error, found } = safeSingle(result, 'profile')
 * if (!found) return NextResponse.json({ error }, { status: 404 })
 */
export function safeSingle<T>(
    result: PostgrestResponse<T>,
    entityName: string = 'record'
): SafeSingleResult<T> {
    if (result.error) {
        return {
            data: null,
            error: `Failed to fetch ${entityName}: ${result.error.message}`,
            found: false,
        }
    }

    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        return {
            data: null,
            error: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)} not found`,
            found: false,
        }
    }

    if (result.data.length > 1) {
        console.warn(`safeSingle: Expected 1 ${entityName}, got ${result.data.length}. Using first.`)
    }

    return {
        data: result.data[0],
        error: null,
        found: true,
    }
}

/**
 * Safely gets the first record from a query, expecting exactly one.
 * Returns appropriate HTTP status codes for different scenarios.
 *
 * @returns Object with data, error message, and suggested HTTP status
 */
export function safeSingleWithStatus<T>(
    result: PostgrestResponse<T>,
    entityName: string = 'record'
): { data: T | null; error: string | null; status: 200 | 404 | 500 } {
    if (result.error) {
        return {
            data: null,
            error: `Failed to fetch ${entityName}: ${result.error.message}`,
            status: 500,
        }
    }

    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
        return {
            data: null,
            error: `${entityName.charAt(0).toUpperCase() + entityName.slice(1)} not found`,
            status: 404,
        }
    }

    return {
        data: result.data[0],
        error: null,
        status: 200,
    }
}

/**
 * Wraps a PostgrestSingleResponse to handle potential null/undefined data.
 * Use this when you need to keep using .single() but want null-safe access.
 */
export function handleSingleResponse<T>(
    result: PostgrestSingleResponse<T>
): { data: T | null; error: string | null } {
    if (result.error) {
        // Check for "no rows" vs other errors
        if (result.error.code === 'PGRST116') {
            return { data: null, error: null } // Not found, but not an error
        }
        return { data: null, error: result.error.message }
    }

    return { data: result.data, error: null }
}

/**
 * Helper to check if a user belongs to an organization.
 * This is a common security check that should be done before org-scoped operations.
 */
export async function verifyOrgMembership(
    supabase: { from: (table: string) => unknown },
    userId: string,
    orgId: string
): Promise<boolean> {
    const client = supabase as {
        from: (table: string) => {
            select: (columns: string) => {
                eq: (col: string, val: string) => {
                    eq: (col: string, val: string) => {
                        limit: (n: number) => Promise<PostgrestResponse<unknown>>
                    }
                }
            }
        }
    }

    const result = await client
        .from('org_members')
        .select('id')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .limit(1)

    return !!(result.data && Array.isArray(result.data) && result.data.length > 0)
}

/**
 * Gets the current user's org ID safely.
 * Returns null if user has no org, with appropriate error messaging.
 */
export async function getCurrentOrgId(
    supabase: {
        from: (table: string) => {
            select: (columns: string) => {
                eq: (col: string, val: string) => {
                    limit: (n: number) => Promise<PostgrestResponse<{ current_org_id: string | null }>>
                }
            }
        }
    },
    userId: string
): Promise<{ orgId: string | null; error: string | null }> {
    const result = await supabase
        .from('profiles')
        .select('current_org_id')
        .eq('id', userId)
        .limit(1)

    if (result.error) {
        return { orgId: null, error: 'Failed to fetch user profile' }
    }

    if (!result.data || result.data.length === 0) {
        return { orgId: null, error: 'User profile not found' }
    }

    const orgId = result.data[0].current_org_id
    if (!orgId) {
        return { orgId: null, error: 'No organization selected' }
    }

    return { orgId, error: null }
}
