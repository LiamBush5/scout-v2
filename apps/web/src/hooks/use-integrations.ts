'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PROVIDERS } from '@/lib/constants'
import type { IntegrationProvider } from '@/types/database'

/**
 * Integration status for a single provider
 */
export interface IntegrationStatus {
    connected: boolean
    metadata?: Record<string, unknown>
    connectedAt?: string
    error?: string
}

/**
 * All integration statuses
 */
export type IntegrationsMap = Record<IntegrationProvider, IntegrationStatus>

/**
 * Hook return type
 */
interface UseIntegrationsReturn {
    integrations: IntegrationsMap
    isLoading: boolean
    error: Error | null
    refetch: () => Promise<void>
    isConnected: (provider: IntegrationProvider) => boolean
    getMetadata: (provider: IntegrationProvider) => Record<string, unknown> | undefined
}

/**
 * Default empty integration status
 */
const defaultStatus: IntegrationStatus = {
    connected: false,
}

/**
 * Default integrations map
 */
const defaultIntegrations: IntegrationsMap = {
    github: { ...defaultStatus },
    slack: { ...defaultStatus },
    datadog: { ...defaultStatus },
    pagerduty: { ...defaultStatus },
}

/**
 * Custom hook for managing integration statuses
 *
 * Fetches and caches integration statuses for the current organization.
 * Provides helper methods for checking connection status.
 *
 * @example
 * ```tsx
 * function IntegrationsPage() {
 *   const { integrations, isConnected, refetch } = useIntegrations()
 *
 *   return (
 *     <div>
 *       {isConnected('github') && <GithubSettings />}
 *       <button onClick={refetch}>Refresh</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useIntegrations(): UseIntegrationsReturn {
    const [integrations, setIntegrations] = useState<IntegrationsMap>(defaultIntegrations)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)

    const fetchIntegrations = useCallback(async () => {
        try {
            setIsLoading(true)
            setError(null)

            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                setIntegrations(defaultIntegrations)
                return
            }

            // Get user's current org
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_org_id')
                .eq('id', user.id)
                .single()

            if (!profile?.current_org_id) {
                setIntegrations(defaultIntegrations)
                return
            }

            // Fetch integrations
            const { data: integrationsData, error: integrationsError } = await supabase
                .from('integrations')
                .select('provider, status, metadata, connected_at, error_message')
                .eq('org_id', profile.current_org_id)

            if (integrationsError) throw integrationsError

            // Build integrations map
            const newIntegrations: IntegrationsMap = { ...defaultIntegrations }

            for (const integration of integrationsData || []) {
                const provider = integration.provider as IntegrationProvider
                if (provider in newIntegrations) {
                    newIntegrations[provider] = {
                        connected: integration.status === 'connected',
                        metadata: integration.metadata as Record<string, unknown> | undefined,
                        connectedAt: integration.connected_at || undefined,
                        error: integration.error_message || undefined,
                    }
                }
            }

            setIntegrations(newIntegrations)
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to fetch integrations'))
        } finally {
            setIsLoading(false)
        }
    }, [])

    const isConnected = useCallback(
        (provider: IntegrationProvider): boolean => {
            return integrations[provider]?.connected ?? false
        },
        [integrations]
    )

    const getMetadata = useCallback(
        (provider: IntegrationProvider): Record<string, unknown> | undefined => {
            return integrations[provider]?.metadata
        },
        [integrations]
    )

    useEffect(() => {
        fetchIntegrations()
    }, [fetchIntegrations])

    return {
        integrations,
        isLoading,
        error,
        refetch: fetchIntegrations,
        isConnected,
        getMetadata,
    }
}

