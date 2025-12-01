import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// POST - Initiate GitHub App installation
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get redirect URL from request body
    const body = await request.json().catch(() => ({}))
    const redirectTo = body.redirectTo || '/onboarding/connect'

    // Generate state for CSRF protection
    const state = crypto.randomUUID()

    const cookieStore = await cookies()
    cookieStore.set('github_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/',
    })

    // Store redirect URL in cookie
    cookieStore.set('github_redirect', redirectTo, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    })

    // GitHub App installation URL
    const githubAppSlug = process.env.GITHUB_APP_SLUG
    if (!githubAppSlug) {
      return NextResponse.json({
        error: 'GitHub App not configured. Please set GITHUB_APP_SLUG in environment variables.'
      }, { status: 500 })
    }

    const installUrl = `https://github.com/apps/${githubAppSlug}/installations/new?state=${state}`

    return NextResponse.json({ url: installUrl })
  } catch (error) {
    console.error('GitHub install error:', error)
    return NextResponse.json({ error: 'Failed to initiate GitHub connection' }, { status: 500 })
  }
}
