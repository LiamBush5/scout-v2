import { NextResponse } from 'next/server'
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

// POST - Test GitHub connection by listing accessible repos
export async function POST() {
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

        // Get installation ID from vault
        const { data: installationId } = await supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'github',
            p_secret_type: 'installation_id',
        })

        if (!installationId) {
            return NextResponse.json({ error: 'GitHub not connected' }, { status: 400 })
        }

        // Check for GitHub App credentials
        const appId = process.env.GITHUB_APP_ID
        const privateKey = process.env.GITHUB_PRIVATE_KEY

        if (!appId || !privateKey) {
            return NextResponse.json({
                error: 'GitHub App not configured. Missing GITHUB_APP_ID or GITHUB_PRIVATE_KEY.'
            }, { status: 500 })
        }

        // Create Octokit instance with app auth
        const octokit = new Octokit({
            authStrategy: createAppAuth,
            auth: {
                appId,
                privateKey,
                installationId: Number(installationId),
            },
        })

        // Test by listing accessible repositories
        const { data: repos } = await octokit.apps.listReposAccessibleToInstallation({
            per_page: 10,
        })

        // Get the installation info
        const { data: installation } = await octokit.apps.getInstallation({
            installation_id: Number(installationId),
        })

        // Extract account info safely
        const account = installation.account as { login?: string; name?: string; type?: string } | null
        const accountName = account?.login || account?.name || 'Unknown'
        const accountType = account?.type || 'Organization'

        return NextResponse.json({
            success: true,
            message: 'GitHub connection is working',
            data: {
                installation_account: accountName,
                account_type: accountType,
                repository_count: repos.total_count,
                sample_repos: repos.repositories.slice(0, 5).map(repo => ({
                    name: repo.full_name,
                    private: repo.private,
                    default_branch: repo.default_branch,
                })),
                permissions: installation.permissions,
            },
        })
    } catch (error) {
        console.error('GitHub test error:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Handle specific errors
        if (errorMessage.includes('Bad credentials')) {
            return NextResponse.json({
                error: 'Invalid GitHub App credentials. Please check your configuration.'
            }, { status: 400 })
        }
        if (errorMessage.includes('Not Found')) {
            return NextResponse.json({
                error: 'GitHub App installation not found. Please reinstall the app.'
            }, { status: 400 })
        }

        return NextResponse.json({ error: 'Failed to test GitHub connection' }, { status: 500 })
    }
}

