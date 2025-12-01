import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// POST - Initiate Slack OAuth
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = process.env.SLACK_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Slack not configured' }, { status: 500 })
    }

    // Get redirect URL from request body
    const body = await request.json().catch(() => ({}))
    const redirectTo = body.redirectTo || '/onboarding/connect'

    // Generate state for CSRF protection
    const state = crypto.randomUUID()

    const cookieStore = await cookies()
    cookieStore.set('slack_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Store redirect URL in cookie
    cookieStore.set('slack_redirect', redirectTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    // Slack OAuth scopes for bot
    const scopes = [
      'chat:write',
      'channels:read',
      'groups:read',
      'incoming-webhook',
      'team:read',
    ].join(',')

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/slack/callback`

    const authUrl = new URL('https://slack.com/oauth/v2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('scope', scopes)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    return NextResponse.json({ url: authUrl.toString() })
  } catch (error) {
    console.error('Slack install error:', error)
    return NextResponse.json({ error: 'Failed to initiate Slack connection' }, { status: 500 })
  }
}
