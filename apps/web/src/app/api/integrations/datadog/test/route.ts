import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { client, v1 } from '@datadog/datadog-api-client'

// POST - Test Datadog connection by fetching monitors and basic info
export async function POST() {
    try {
        const supabase = await createClient()
        const auth = await getUserOrg(supabase)
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const orgId = auth.orgId
        const supabaseAdmin = getSupabaseAdmin()

        // Get credentials from vault
        const { data: apiKey } = await supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'datadog',
            p_secret_type: 'api_key',
        })

        const { data: appKey } = await supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'datadog',
            p_secret_type: 'app_key',
        })

        const { data: site } = await supabaseAdmin.rpc('get_integration_secret', {
            p_org_id: orgId,
            p_provider: 'datadog',
            p_secret_type: 'site',
        })

        if (!apiKey || !appKey) {
            return NextResponse.json({ error: 'Datadog not connected' }, { status: 400 })
        }

        // Create Datadog configuration
        const configuration = client.createConfiguration({
            authMethods: {
                apiKeyAuth: apiKey,
                appKeyAuth: appKey,
            },
        })
        client.setServerVariables(configuration, { site: site || 'datadoghq.com' })

        // Test 1: Validate credentials
        const authApi = new v1.AuthenticationApi(configuration)
        await authApi.validate()

        // Test 2: List monitors (limited to 5)
        const monitorsApi = new v1.MonitorsApi(configuration)
        const monitors = await monitorsApi.listMonitors({
            pageSize: 5,
        })

        // Test 3: Get basic usage info
        let usageInfo = null
        try {
            const usageApi = new v1.UsageMeteringApi(configuration)
            const now = new Date()
            const startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

            const usage = await usageApi.getUsageSummary({
                startMonth: startDate,
            })
            // Type assertion to access usage data
            const usageData = usage as { hostCount?: number; containerCount?: number }
            usageInfo = {
                hosts_count: usageData.hostCount || 0,
                container_count: usageData.containerCount || 0,
            }
        } catch {
            // Usage API might not be available for all accounts
            usageInfo = null
        }

        // Prepare monitor summary
        const monitorSummary = monitors.map(m => ({
            id: m.id,
            name: m.name,
            type: m.type,
            state: m.overallState,
        }))

        // Count by state
        const monitorStats = {
            total: monitors.length,
            ok: monitors.filter(m => m.overallState === 'OK').length,
            alert: monitors.filter(m => m.overallState === 'Alert').length,
            warn: monitors.filter(m => m.overallState === 'Warn').length,
            no_data: monitors.filter(m => m.overallState === 'No Data').length,
        }

        return NextResponse.json({
            success: true,
            message: 'Datadog connection is working',
            data: {
                site: site || 'datadoghq.com',
                monitors: {
                    stats: monitorStats,
                    sample: monitorSummary,
                },
                usage: usageInfo,
            },
        })
    } catch (error) {
        console.error('Datadog test error:', error)

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Handle specific errors
        if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
            return NextResponse.json({
                error: 'Invalid Datadog credentials or insufficient permissions.'
            }, { status: 400 })
        }
        if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
            return NextResponse.json({
                error: 'Invalid Datadog API key. Please reconnect your Datadog account.'
            }, { status: 400 })
        }

        return NextResponse.json({ error: 'Failed to test Datadog connection' }, { status: 500 })
    }
}

