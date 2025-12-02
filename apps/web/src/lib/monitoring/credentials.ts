/**
 * Credential loading utilities for monitoring jobs
 *
 * Loads integration credentials from Supabase Vault securely.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { Credentials } from './types'

/**
 * Load all integration credentials for an organization
 *
 * Uses Promise.allSettled to load all credentials in parallel,
 * gracefully handling missing integrations.
 */
export async function loadCredentials(
    orgId: string,
    supabaseAdmin: SupabaseClient
): Promise<Credentials> {
    const credentials: Credentials = {}

    const [datadogCreds, githubCreds, slackCreds] = await Promise.allSettled([
        loadDatadogCredentials(orgId, supabaseAdmin),
        loadGitHubCredentials(orgId, supabaseAdmin),
        loadSlackCredentials(orgId, supabaseAdmin),
    ])

    if (datadogCreds.status === 'fulfilled' && datadogCreds.value) {
        credentials.datadog = datadogCreds.value
    }

    if (githubCreds.status === 'fulfilled' && githubCreds.value) {
        credentials.github = githubCreds.value
    }

    if (slackCreds.status === 'fulfilled' && slackCreds.value) {
        credentials.slack = slackCreds.value
    }

    return credentials
}

async function loadDatadogCredentials(
    orgId: string,
    supabaseAdmin: SupabaseClient
): Promise<Credentials['datadog'] | null> {
    const [apiKeyRes, appKeyRes, siteRes] = await Promise.all([
        supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'datadog',
            p_secret_type: 'api_key',
        }),
        supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'datadog',
            p_secret_type: 'app_key',
        }),
        supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'datadog',
            p_secret_type: 'site',
        }),
    ])

    if (apiKeyRes?.data && appKeyRes?.data) {
        return {
            apiKey: apiKeyRes.data as string,
            appKey: appKeyRes.data as string,
            site: (siteRes?.data as string) || 'datadoghq.com',
        }
    }

    return null
}

async function loadGitHubCredentials(
    orgId: string,
    supabaseAdmin: SupabaseClient
): Promise<Credentials['github'] | null> {
    const appId = process.env.GITHUB_APP_ID
    const privateKey = process.env.GITHUB_PRIVATE_KEY

    if (!appId || !privateKey) {
        return null
    }

    const installationIdRes = await supabaseAdmin.rpc('get_integration_secret', {
        p_org_id: orgId,
        p_provider: 'github',
        p_secret_type: 'installation_id',
    })

    if (installationIdRes?.data) {
        return {
            appId,
            privateKey: privateKey.replace(/\\n/g, '\n'),
            installationId: parseInt(installationIdRes.data as string, 10),
        }
    }

    return null
}

async function loadSlackCredentials(
    orgId: string,
    supabaseAdmin: SupabaseClient
): Promise<Credentials['slack'] | null> {
    const [botTokenRes, channelIdRes] = await Promise.all([
        supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'slack',
            p_secret_type: 'bot_token',
        }),
        supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'slack',
            p_secret_type: 'channel_id',
        }),
    ])

    if (botTokenRes?.data && channelIdRes?.data) {
        return {
            botToken: botTokenRes.data as string,
            channelId: channelIdRes.data as string,
        }
    }

    return null
}
