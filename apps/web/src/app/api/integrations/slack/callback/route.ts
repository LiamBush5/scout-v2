import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Handle Slack OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // Verify state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('slack_oauth_state')?.value
  const redirectBase = cookieStore.get('slack_redirect')?.value || '/onboarding/connect'

  // Handle user denial
  if (error) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=slack_denied`, baseUrl))
  }

  if (state !== storedState) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=invalid_state`, baseUrl))
  }

  // Clear cookies
  cookieStore.delete('slack_oauth_state')
  cookieStore.delete('slack_redirect')

  if (!code) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=no_code`, baseUrl))
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', baseUrl))
    }

    // Get user's org
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.current_org_id) {
      return NextResponse.redirect(new URL(`${redirectBase}?error=no_org`, baseUrl))
    }

    const orgId = profile.current_org_id

    // Exchange code for token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: `${baseUrl}/api/integrations/slack/callback`,
      }),
    })

    const data = await tokenResponse.json()

    if (!data.ok) {
      console.error('Slack token exchange failed:', data.error)
      return NextResponse.redirect(new URL(`${redirectBase}?error=slack_token_failed`, baseUrl))
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Store bot token in Vault
    await supabaseAdmin.rpc('store_integration_secret', {
      p_org_id: orgId,
      p_provider: 'slack',
      p_secret_type: 'bot_token',
      p_secret_value: data.access_token,
    })

    // Store webhook channel if available
    if (data.incoming_webhook?.channel_id) {
      await supabaseAdmin.rpc('store_integration_secret', {
        p_org_id: orgId,
        p_provider: 'slack',
        p_secret_type: 'channel_id',
        p_secret_value: data.incoming_webhook.channel_id,
      })
    }

    // Upsert integration status with metadata
    await supabaseAdmin
      .from('integrations')
      .upsert({
        org_id: orgId,
        provider: 'slack',
        status: 'connected',
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        metadata: {
          team_id: data.team?.id,
          team_name: data.team?.name,
          bot_user_id: data.bot_user_id,
          channel_name: data.incoming_webhook?.channel,
          channel_id: data.incoming_webhook?.channel_id,
        },
        error_message: null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,provider',
      })

    return NextResponse.redirect(new URL(`${redirectBase}?slack=connected`, baseUrl))
  } catch (error) {
    console.error('Slack callback error:', error)
    return NextResponse.redirect(new URL(`${redirectBase}?error=slack_failed`, baseUrl))
  }
}
