import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'

// GET - List Slack channels
export async function GET() {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const supabaseAdmin = getSupabaseAdmin()

    // Get bot token from vault
    const { data: botToken } = await supabaseAdmin.rpc('get_integration_secret', {
      p_org_id: orgId,
      p_provider: 'slack',
      p_secret_type: 'bot_token',
    })

    if (!botToken) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    // Fetch channels from Slack with proper error handling
    let response: Response
    try {
      response = await fetch('https://slack.com/api/conversations.list', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${botToken}`,
          'Content-Type': 'application/json',
        },
      })
    } catch (fetchError) {
      console.error('Slack API network error:', fetchError)
      return NextResponse.json({ error: 'Failed to connect to Slack API' }, { status: 502 })
    }

    if (!response.ok) {
      console.error('Slack API HTTP error:', response.status)
      return NextResponse.json({ error: `Slack API returned ${response.status}` }, { status: 502 })
    }

    let data: unknown
    try {
      data = await response.json()
    } catch (parseError) {
      console.error('Failed to parse Slack response:', parseError)
      return NextResponse.json({ error: 'Invalid response from Slack API' }, { status: 502 })
    }

    // Validate the response structure
    if (!data || typeof data !== 'object') {
      console.error('Unexpected Slack response format')
      return NextResponse.json({ error: 'Unexpected response from Slack API' }, { status: 502 })
    }

    const slackData = data as { ok?: boolean; error?: string; channels?: unknown[] }

    if (!slackData.ok) {
      console.error('Slack API error:', slackData.error)
      return NextResponse.json({ error: slackData.error || 'Failed to fetch channels' }, { status: 400 })
    }

    if (!Array.isArray(slackData.channels)) {
      console.error('Slack response missing channels array')
      return NextResponse.json({ error: 'Invalid channel data from Slack' }, { status: 502 })
    }

    // Safely filter and map channels with type guards
    interface SlackChannel {
      id: string
      name: string
      is_private?: boolean
      is_archived?: boolean
    }

    const channels = slackData.channels
      .filter((c): c is SlackChannel => {
        if (c === null || typeof c !== 'object') return false
        const channel = c as Record<string, unknown>
        return (
          typeof channel.id === 'string' &&
          typeof channel.name === 'string' &&
          channel.is_archived !== true
        )
      })
      .map((c) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private ?? false,
      }))

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Slack channels error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}
