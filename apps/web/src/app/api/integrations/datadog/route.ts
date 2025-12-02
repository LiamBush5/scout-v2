import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { disconnectIntegration, updateIntegrationStatus } from '@/lib/integrations/helpers'
import { client, v1 } from '@datadog/datadog-api-client'

// POST - Connect Datadog (save credentials)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { apiKey, appKey, site = 'datadoghq.com' } = body

    if (!apiKey || !appKey) {
      return NextResponse.json({ error: 'API Key and App Key are required' }, { status: 400 })
    }

    const orgId = auth.orgId

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

    // Update integration status
    await updateIntegrationStatus(orgId, 'datadog', supabaseAdmin, 'connected', auth.userId, { site })

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
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const supabaseAdmin = getSupabaseAdmin()

    await disconnectIntegration(orgId, 'datadog', supabaseAdmin)

    return NextResponse.json({ success: true, message: 'Datadog disconnected' })
  } catch (error) {
    console.error('Datadog disconnect error:', error)
    return NextResponse.json({ error: 'Failed to disconnect Datadog' }, { status: 500 })
  }
}
