import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

function getSupabaseAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Handle GitHub App installation callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action')
  const state = searchParams.get('state')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

  // Verify state
  const cookieStore = await cookies()
  const storedState = cookieStore.get('github_oauth_state')?.value
  const redirectBase = cookieStore.get('github_redirect')?.value || '/onboarding/connect'

  if (state && state !== storedState) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=invalid_state`, baseUrl))
  }

  // Clear cookies
  cookieStore.delete('github_oauth_state')
  cookieStore.delete('github_redirect')

  // Handle uninstall
  if (setupAction === 'install' && !installationId) {
    return NextResponse.redirect(new URL(`${redirectBase}?error=no_installation`, baseUrl))
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

    if (installationId) {
      // Fetch installation details to get repos
      let repos: string[] = []
      let accountLogin = ''

      try {
        const appId = process.env.GITHUB_APP_ID
        const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n')

        if (appId && privateKey) {
          const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
              appId,
              privateKey,
              installationId: parseInt(installationId),
            },
          })

          // Get installation info
          const { data: installation } = await octokit.apps.getInstallation({
            installation_id: parseInt(installationId),
          })

          // Account can be either a User (with login) or an Organization (with slug/name)
          const account = installation.account
          if (account && 'login' in account) {
            accountLogin = account.login
          } else if (account && 'slug' in account) {
            accountLogin = account.slug
          }

          // Get repos accessible to this installation
          const { data: repoData } = await octokit.apps.listReposAccessibleToInstallation({
            per_page: 100,
          })

          repos = repoData.repositories.map((r) => r.full_name)
        }
      } catch (error) {
        console.error('Failed to fetch GitHub installation details:', error)
        // Continue anyway - we have the installation ID
      }

      const supabaseAdmin = getSupabaseAdmin()

      // Store installation ID in Vault
      await supabaseAdmin.rpc('store_integration_secret', {
        p_org_id: orgId,
        p_provider: 'github',
        p_secret_type: 'installation_id',
        p_secret_value: installationId,
      })

      // Upsert integration status with metadata
      await supabaseAdmin
        .from('integrations')
        .upsert({
          org_id: orgId,
          provider: 'github',
          status: 'connected',
          connected_by: user.id,
          connected_at: new Date().toISOString(),
          metadata: {
            installation_id: installationId,
            account: accountLogin,
            repos: repos.slice(0, 20), // Store first 20 repos
            repo_count: repos.length,
          },
          error_message: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'org_id,provider',
        })

      return NextResponse.redirect(new URL(`${redirectBase}?github=connected`, baseUrl))
    }

    return NextResponse.redirect(new URL(`${redirectBase}?error=no_installation`, baseUrl))
  } catch (error) {
    console.error('GitHub callback error:', error)
    return NextResponse.redirect(new URL(`${redirectBase}?error=github_failed`, baseUrl))
  }
}
