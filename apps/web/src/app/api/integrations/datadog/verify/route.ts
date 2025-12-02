import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'

// POST - Verify Datadog connection
export async function POST() {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const supabaseAdmin = getSupabaseAdmin()

    // Get API key from vault
    const { data: apiKey } = await supabaseAdmin.rpc('get_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'api_key',
    })

    // Get App key from vault
    const { data: appKey } = await supabaseAdmin.rpc('get_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'app_key',
    })

    if (!apiKey || !appKey) {
      return NextResponse.json({ error: 'Datadog not connected' }, { status: 400 })
    }

    // Get site from integration metadata
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('metadata')
      .eq('org_id', orgId)
      .eq('provider', 'datadog')
      .single()

    const site = integration?.metadata?.site || 'datadoghq.com'

    // Verify connection by calling Datadog API
    const response = await fetch(`https://api.${site}/api/v1/validate`, {
      method: 'GET',
      headers: {
        'DD-API-KEY': apiKey,
        'DD-APPLICATION-KEY': appKey,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Datadog validation failed:', errorData)

      // Update integration status to error
      await supabaseAdmin
        .from('integrations')
        .update({
          error_message: 'Connection verification failed',
          updated_at: new Date().toISOString(),
        })
        .eq('org_id', orgId)
        .eq('provider', 'datadog')

      return NextResponse.json({
        error: 'Invalid API credentials',
        details: errorData.errors?.[0] || 'Connection verification failed'
      }, { status: 400 })
    }

    const data = await response.json()

    // Update integration - clear any error messages
    await supabaseAdmin
      .from('integrations')
      .update({
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('provider', 'datadog')

    return NextResponse.json({
      success: true,
      valid: data.valid,
    })
  } catch (error) {
    console.error('Datadog verify error:', error)
    return NextResponse.json({ error: 'Failed to verify connection' }, { status: 500 })
  }
}
