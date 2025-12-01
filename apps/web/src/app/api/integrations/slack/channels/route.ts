import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - List Slack channels
export async function GET() {
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

    // Fetch channels from Slack
    const response = await fetch('https://slack.com/api/conversations.list', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!data.ok) {
      console.error('Slack API error:', data.error)
      return NextResponse.json({ error: data.error || 'Failed to fetch channels' }, { status: 400 })
    }

    const channels = data.channels
      .filter((c: { is_archived: boolean }) => !c.is_archived)
      .map((c: { id: string; name: string; is_private: boolean }) => ({
        id: c.id,
        name: c.name,
        is_private: c.is_private,
      }))

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('Slack channels error:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}
