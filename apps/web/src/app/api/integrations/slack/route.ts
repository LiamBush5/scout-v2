import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// PATCH - Update Slack settings (channels - supports single or multiple)
export async function PATCH(request: NextRequest) {
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
      const channelResponse = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
        headers: {
          'Authorization': `Bearer ${botToken}`,
        },
      })
      const channelData = await channelResponse.json()
      channelNames.push(channelData.ok ? channelData.channel?.name : channelId)
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

    // Delete secrets from Vault
    await supabaseAdmin.rpc('delete_integration_secret', {
      p_org_id: orgId,
      p_provider: 'slack',
      p_secret_type: 'bot_token',
    })
    await supabaseAdmin.rpc('delete_integration_secret', {
      p_org_id: orgId,
      p_provider: 'slack',
      p_secret_type: 'channel_id',
    })

    // Update integration status
    await supabaseAdmin
      .from('integrations')
      .update({
        status: 'disconnected',
        connected_by: null,
        connected_at: null,
        metadata: {},
      })
      .eq('org_id', orgId)
      .eq('provider', 'slack')

    return NextResponse.json({ success: true, message: 'Slack disconnected' })
  } catch (error) {
    console.error('Slack disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Slack' }, { status: 500 })
  }
}
