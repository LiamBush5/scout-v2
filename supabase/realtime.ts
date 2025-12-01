// src/lib/supabase/realtime.ts
/**
 * Supabase Realtime Subscriptions
 * 
 * Subscribe to live investigation updates for real-time UI updates.
 */

import { createSupabaseBrowserClient } from './client'
import type { Investigation, InvestigationEvent } from '@/types/database'
import { useEffect, useState } from 'react'

// =============================================================================
// TYPES
// =============================================================================

type RealtimePayload<T> = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: T
  old: T
}

type InvestigationUpdateHandler = (investigation: Investigation) => void
type InvestigationEventHandler = (event: InvestigationEvent) => void

// =============================================================================
// SUBSCRIPTION FUNCTIONS
// =============================================================================

/**
 * Subscribe to investigation updates for an organization
 */
export function subscribeToInvestigations(
  orgId: string,
  onUpdate: InvestigationUpdateHandler
) {
  const supabase = createSupabaseBrowserClient()

  const channel = supabase
    .channel(`investigations:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'investigations',
        filter: `org_id=eq.${orgId}`,
      },
      (payload: RealtimePayload<Investigation>) => {
        onUpdate(payload.new)
      }
    )
    .subscribe()

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to a specific investigation's events (live timeline)
 */
export function subscribeToInvestigationEvents(
  investigationId: string,
  onEvent: InvestigationEventHandler
) {
  const supabase = createSupabaseBrowserClient()

  const channel = supabase
    .channel(`investigation_events:${investigationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'investigation_events',
        filter: `investigation_id=eq.${investigationId}`,
      },
      (payload: RealtimePayload<InvestigationEvent>) => {
        onEvent(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Subscribe to broadcast channel for org-specific updates
 * (Uses the custom broadcast function from our SQL setup)
 */
export function subscribeToBroadcast(
  orgId: string,
  onMessage: (payload: any) => void
) {
  const supabase = createSupabaseBrowserClient()

  const channel = supabase
    .channel(`investigation:${orgId}`, {
      config: { private: true },
    })
    .on('broadcast', { event: '*' }, (payload) => {
      onMessage(payload)
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// =============================================================================
// REACT HOOKS
// =============================================================================

/**
 * Hook to subscribe to investigation updates
 */
export function useInvestigationSubscription(orgId: string | undefined) {
  const [latestUpdate, setLatestUpdate] = useState<Investigation | null>(null)

  useEffect(() => {
    if (!orgId) return

    const unsubscribe = subscribeToInvestigations(orgId, (investigation) => {
      setLatestUpdate(investigation)
    })

    return () => {
      unsubscribe()
    }
  }, [orgId])

  return latestUpdate
}

/**
 * Hook to subscribe to a specific investigation's live events
 */
export function useInvestigationEvents(investigationId: string | undefined) {
  const [events, setEvents] = useState<InvestigationEvent[]>([])

  useEffect(() => {
    if (!investigationId) return

    const unsubscribe = subscribeToInvestigationEvents(
      investigationId,
      (event) => {
        setEvents((prev) => [...prev, event])
      }
    )

    return () => {
      unsubscribe()
    }
  }, [investigationId])

  return events
}

/**
 * Hook to get real-time investigation status
 */
export function useInvestigationStatus(investigationId: string | undefined) {
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!investigationId) return

    const supabase = createSupabaseBrowserClient()

    // Initial fetch
    async function fetchInvestigation() {
      const { data, error } = await supabase
        .from('investigations')
        .select('*')
        .eq('id', investigationId)
        .single()

      if (!error && data) {
        setInvestigation(data)
      }
      setIsLoading(false)
    }

    fetchInvestigation()

    // Subscribe to updates
    const channel = supabase
      .channel(`investigation:${investigationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'investigations',
          filter: `id=eq.${investigationId}`,
        },
        (payload: RealtimePayload<Investigation>) => {
          setInvestigation(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [investigationId])

  return { investigation, isLoading }
}

// =============================================================================
// PRESENCE (For showing who's viewing)
// =============================================================================

/**
 * Track presence on an investigation page
 */
export function useInvestigationPresence(
  investigationId: string | undefined,
  userId: string | undefined,
  userName: string | undefined
) {
  const [viewers, setViewers] = useState<
    Array<{ id: string; name: string; joinedAt: string }>
  >([])

  useEffect(() => {
    if (!investigationId || !userId || !userName) return

    const supabase = createSupabaseBrowserClient()

    const channel = supabase.channel(`presence:${investigationId}`, {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state)
          .flat()
          .map((presence: any) => ({
            id: presence.user_id,
            name: presence.user_name,
            joinedAt: presence.joined_at,
          }))
        setViewers(users)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            user_name: userName,
            joined_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [investigationId, userId, userName])

  return viewers
}
