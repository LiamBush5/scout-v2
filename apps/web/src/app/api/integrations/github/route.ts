import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { disconnectIntegration } from '@/lib/integrations/helpers'

// PATCH - Update GitHub settings
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
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
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const supabaseAdmin = getSupabaseAdmin()

    await disconnectIntegration(orgId, 'github', supabaseAdmin)

    return NextResponse.json({ success: true, message: 'GitHub disconnected' })
  } catch (error) {
    console.error('GitHub disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect GitHub' }, { status: 500 })
  }
}
