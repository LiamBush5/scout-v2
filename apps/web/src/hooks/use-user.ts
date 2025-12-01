'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types/database'

/**
 * User data returned by the hook
 */
export interface UserData {
    id: string
    email: string
    fullName: string | null
    avatarUrl: string | null
    initials: string
    currentOrgId: string | null
}

/**
 * Full user profile with organization
 */
export interface UserProfile extends UserData {
    organization: Organization | null
    createdAt: string
}

/**
 * Hook return type
 */
interface UseUserReturn {
    user: UserData | null
    profile: UserProfile | null
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<void>
    signOut: () => Promise<void>
}

/**
 * Generate initials from a name or email
 */
function getInitials(name: string | null | undefined, email: string): string {
    const source = name || email
    return source
        .split(/[\s@]/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

/**
 * Custom hook for managing user authentication state
 *
 * Provides user data, profile, and authentication actions.
 * Handles caching and automatic refetching.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isLoading, signOut } = useUser()
 *
 *   if (isLoading) return <Spinner />
 *   if (!user) return <LoginPrompt />
 *
 *   return <div>Hello, {user.fullName}</div>
 * }
 * ```
 */
export function useUser(): UseUserReturn {
    const [user, setUser] = useState<UserData | null>(null)
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchUser = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)

            const supabase = createClient()
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

            if (authError) throw authError
            if (!authUser) {
                setUser(null)
                setProfile(null)
                return
            }

            // Fetch profile data
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authUser.id)
                .single()

            if (profileError && profileError.code !== 'PGRST116') {
                throw profileError
            }

            const email = authUser.email || ''
            const fullName = profileData?.full_name || null
            const initials = getInitials(fullName, email)

            const userData: UserData = {
                id: authUser.id,
                email,
                fullName,
                avatarUrl: profileData?.avatar_url || null,
                initials,
                currentOrgId: profileData?.current_org_id || null,
            }

            setUser(userData)

            // Fetch organization if user has one
            let organization: Organization | null = null
            if (profileData?.current_org_id) {
                const { data: orgData } = await supabase
                    .from('organizations')
                    .select('*')
                    .eq('id', profileData.current_org_id)
                    .single()

                organization = orgData
            }

            setProfile({
                ...userData,
                organization,
                createdAt: authUser.created_at,
            })
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch user'))
            setUser(null)
            setProfile(null)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const signOut = useCallback(async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        setUser(null)
        setProfile(null)
    }, [])

    useEffect(() => {
        fetchUser()

        // Subscribe to auth changes
        const supabase = createClient()
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                setUser(null)
                setProfile(null)
            } else {
                fetchUser()
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [fetchUser])

    return {
        user,
        profile,
        isLoading,
        error,
        refetch: fetchUser,
        signOut,
    }
}

