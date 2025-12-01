import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Send test message to Slack
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.current_org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const orgId = profile.current_org_id
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

    // Get channel from integration metadata
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('metadata')
      .eq('org_id', orgId)
      .eq('provider', 'slack')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    const channelId = integration.metadata?.channel_id
    if (!channelId) {
      return NextResponse.json({ error: 'No channel configured. Please select a channel first.' }, { status: 400 })
    }

    // Send test message
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ':white_check_mark: *Scout AI Test Message*\n\nYour Slack integration is working correctly! Investigation results will be posted to this channel.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Sent at ${new Date().toISOString()}`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()

    if (!data.ok) {
      console.error('Slack API error:', data.error)

      // Handle specific errors
      if (data.error === 'channel_not_found') {
        return NextResponse.json({ error: 'Channel not found. Please select a different channel.' }, { status: 400 })
      }
      if (data.error === 'not_in_channel') {
        return NextResponse.json({ error: 'Bot is not in this channel. Please invite @Scout AI to the channel.' }, { status: 400 })
      }

      return NextResponse.json({ error: data.error || 'Failed to send message' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message_ts: data.ts })
  } catch (error) {
    console.error('Slack test message error:', error)
    return NextResponse.json({ error: 'Failed to send test message' }, { status: 500 })
  }
}
