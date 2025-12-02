import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { disconnectIntegration } from '@/lib/integrations/helpers'

// PATCH - Update Slack settings (channels - supports single or multiple)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const body = await request.json()

    // Support both single channel_id and multiple channel_ids
    const channelIds: string[] = body.channel_ids || (body.channel_id ? [body.channel_id] : [])

    if (channelIds.length === 0) {
      return NextResponse.json({ error: 'At least one channel ID is required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Get bot token to fetch channel names
    const { data: botToken } = await supabaseAdmin.rpc('get_integration_secret', {
      p_org_id: orgId,
      p_provider: 'slack',
      p_secret_type: 'bot_token',
    })

    if (!botToken) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    // Get channel info from Slack for each channel
    const channelNames: string[] = []
    for (const channelId of channelIds) {
      try {
        const channelResponse = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
          headers: {
            'Authorization': `Bearer ${botToken}`,
          },
        })

        if (!channelResponse.ok) {
          console.warn(`Slack API HTTP error for channel ${channelId}: ${channelResponse.status}`)
          channelNames.push(channelId) // Fallback to ID
          continue
        }

        const channelData = await channelResponse.json()

        if (!channelData || typeof channelData !== 'object') {
          console.warn(`Invalid Slack API response for channel ${channelId}`)
          channelNames.push(channelId)
          continue
        }

        channelNames.push(channelData.ok && channelData.channel?.name ? channelData.channel.name : channelId)
      } catch (err) {
        console.warn(`Failed to fetch Slack channel info for ${channelId}:`, err)
        channelNames.push(channelId) // Fallback to ID on error
      }
    }

    // Get current integration
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('metadata')
      .eq('org_id', orgId)
      .eq('provider', 'slack')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    // Update metadata with channels (support both single and multiple)
    const newMetadata = {
      ...integration.metadata,
      channel_ids: channelIds,
      channel_names: channelNames,
      // Keep backward compatibility with single channel
      channel_id: channelIds[0],
      channel_name: channelNames[0],
    }

    await supabaseAdmin
      .from('integrations')
      .update({
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('provider', 'slack')

    return NextResponse.json({
      success: true,
      channel_ids: channelIds,
      channel_names: channelNames,
    })
  } catch (error) {
    console.error('Slack update error:', error)
    return NextResponse.json({ error: 'Failed to update Slack settings' }, { status: 500 })
  }
}

// DELETE - Disconnect Slack
export async function DELETE() {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const supabaseAdmin = getSupabaseAdmin()

    await disconnectIntegration(orgId, 'slack', supabaseAdmin)

    return NextResponse.json({ success: true, message: 'Slack disconnected' })
  } catch (error) {
    console.error('Slack disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Slack' }, { status: 500 })
  }
}
