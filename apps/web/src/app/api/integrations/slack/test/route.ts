import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'

// POST - Send test message to Slack
export async function POST() {
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

    // Support both single channel_id and multiple channel_ids
    const channelIds: string[] = integration.metadata?.channel_ids ||
      (integration.metadata?.channel_id ? [integration.metadata.channel_id as string] : [])

    if (channelIds.length === 0) {
      return NextResponse.json({ error: 'No channels configured. Please select at least one channel first.' }, { status: 400 })
    }

    const results: { channelId: string; success: boolean; error?: string }[] = []

    // Send test message to all selected channels
    for (const channelId of channelIds) {
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
        console.error('Slack API error:', data.error, 'for channel:', channelId)

        let errorMessage = data.error || 'Failed to send message'
        if (data.error === 'channel_not_found') {
          errorMessage = 'Channel not found'
        } else if (data.error === 'not_in_channel') {
          errorMessage = 'Bot not in channel - please invite @Scout AI'
        }

        results.push({ channelId, success: false, error: errorMessage })
      } else {
        results.push({ channelId, success: true })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failedResults = results.filter(r => !r.success)

    if (successCount === 0) {
      return NextResponse.json({
        error: failedResults[0]?.error || 'Failed to send to all channels'
      }, { status: 400 })
    }

    if (failedResults.length > 0) {
      return NextResponse.json({
        success: true,
        partial: true,
        message: `Sent to ${successCount} of ${channelIds.length} channels`,
        results,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Sent to ${successCount} channel${successCount !== 1 ? 's' : ''}`,
      results,
    })
  } catch (error) {
    console.error('Slack test message error:', error)
    return NextResponse.json({ error: 'Failed to send test message' }, { status: 500 })
  }
}
