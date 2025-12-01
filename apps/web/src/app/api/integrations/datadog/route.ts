import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { client, v1 } from '@datadog/datadog-api-client'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Connect Datadog (save credentials)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { apiKey, appKey, site = 'datadoghq.com' } = body

    if (!apiKey || !appKey) {
      return NextResponse.json({ error: 'API Key and App Key are required' }, { status: 400 })
    }

    // Get user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.current_org_id) {
      return NextResponse.json({ error: 'No organization found' }, { status: 400 })
    }

    const orgId = profile.current_org_id

    // Validate credentials by calling Datadog API
    try {
      const configuration = client.createConfiguration({
        authMethods: {
          apiKeyAuth: apiKey,
          appKeyAuth: appKey,
        },
      })
      client.setServerVariables(configuration, { site })

      const authApi = new v1.AuthenticationApi(configuration)
      await authApi.validate()
    } catch (error) {
      console.error('Datadog validation failed:', error)
      return NextResponse.json(
        { error: 'Invalid Datadog credentials. Please check your API Key and App Key.' },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Store credentials in Vault
    await supabaseAdmin.rpc('store_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'api_key',
      p_secret_value: apiKey,
    })

    await supabaseAdmin.rpc('store_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'app_key',
      p_secret_value: appKey,
    })

    await supabaseAdmin.rpc('store_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'site',
      p_secret_value: site,
    })

    // Upsert integration status
    await supabaseAdmin
      .from('integrations')
      .upsert({
        org_id: orgId,
        provider: 'datadog',
        status: 'connected',
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        metadata: { site },
        error_message: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,provider',
      })

    return NextResponse.json({ success: true, message: 'Datadog connected successfully' })
  } catch (error) {
    console.error('Datadog connection error:', error)
    return NextResponse.json({ error: 'Failed to connect Datadog' }, { status: 500 })
  }
}

// DELETE - Disconnect Datadog
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
      p_provider: 'datadog',
      p_secret_type: 'api_key',
    })
    await supabaseAdmin.rpc('delete_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'app_key',
    })
    await supabaseAdmin.rpc('delete_integration_secret', {
      p_org_id: orgId,
      p_provider: 'datadog',
      p_secret_type: 'site',
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
      .eq('provider', 'datadog')

    return NextResponse.json({ success: true, message: 'Datadog disconnected' })
  } catch (error) {
    console.error('Datadog disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Datadog' }, { status: 500 })
  }
}
