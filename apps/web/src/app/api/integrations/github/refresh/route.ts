import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

// POST - Refresh GitHub repos
export async function POST() {
  try {
    const supabase = await createClient()
    const auth = await getUserOrg(supabase)
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const orgId = auth.orgId
    const supabaseAdmin = getSupabaseAdmin()

    // Get installation ID from vault
    const { data: secretData } = await supabaseAdmin.rpc('get_integration_secret', {
      p_org_id: orgId,
      p_provider: 'github',
      p_secret_type: 'installation_id',
    })

    if (!secretData) {
      return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
    }

    const installationId = secretData

    // Fetch repos
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_PRIVATE_KEY?.replace(/\\n/g, '\n')

    if (!appId || !privateKey) {
      return NextResponse.json({ error: 'GitHub App not configured' }, { status: 500 })
    }

    const octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId: parseInt(installationId),
      },
    })

    const { data: repoData } = await octokit.apps.listReposAccessibleToInstallation({
      per_page: 100,
    })

    const repos = repoData.repositories.map((r) => r.full_name)

    // Get current integration metadata
    const { data: integration } = await supabaseAdmin
      .from('integrations')
      .select('metadata')
      .eq('org_id', orgId)
      .eq('provider', 'github')
      .single()

    // Update integration metadata
    const newMetadata = {
      ...(integration?.metadata || {}),
      repos,
      repo_count: repos.length,
    }

    await supabaseAdmin
      .from('integrations')
      .update({
        metadata: newMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('org_id', orgId)
      .eq('provider', 'github')

    return NextResponse.json({ repos, repo_count: repos.length })
  } catch (error) {
    console.error('GitHub refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh repositories' }, { status: 500 })
  }
}
