import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// PATCH - Update GitHub settings
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
    const { selected_repos } = body

    const supabaseAdmin = getSupabaseAdmin()

    // Get current integration
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('metadata')
      .eq('org_id', orgId)
      .eq('provider', 'github')
      .single()

    if (!integration) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    // Update metadata with selected repos
    const newMetadata = {
      ...integration.metadata,
      selected_repos,
    }

    await supabaseAdmin
      .from('integrations')
      .update({
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('provider', 'github')

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('GitHub update error:', error)
    return NextResponse.json({ error: 'Failed to update GitHub settings' }, { status: 500 })
  }
}

// DELETE - Disconnect GitHub
export async function DELETE(request: NextRequest) {
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
      p_provider: 'github',
      p_secret_type: 'installation_id',
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
      .eq('provider', 'github')

    return NextResponse.json({ success: true, message: 'GitHub disconnected' })
  } catch (error) {
    console.error('GitHub disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect GitHub' }, { status: 500 })
  }
}
