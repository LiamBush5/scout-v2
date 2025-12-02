import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
// Types for agent credentials
interface DatadogCredentials {
    apiKey: string
    appKey: string
    site: string
}

interface GitHubCredentials {
    appId: string
    privateKey: string
    installationId: number
}

interface SlackCredentials {
    botToken: string
    defaultChannelId: string
}
import { logger } from '@/lib/utils/logger'
import { ValidationError, NotFoundError, getErrorMessage, AppError } from '@/lib/utils/errors'
import { uuidSchema, requireEnv } from '@/lib/utils/validation'
import { retryWithBackoff } from '@/lib/utils/retry'

/**
 * Request body schema for investigation endpoint
 */
const investigateRequestSchema = z.object({
    investigationId: uuidSchema,
    orgId: uuidSchema,
})

export const maxDuration = 300 // 5 minutes

/**
 * Agent investigation endpoint
 *
 * Runs an AI-powered investigation for a queued investigation.
 *
 * Flow:
 * 1. Validate request
 * 2. Load investigation from database
 * 3. Load encrypted credentials from Vault
 * 4. Run LangGraph investigation
 * 5. Update investigation with results
 *
 * @param request - Next.js request with investigationId and orgId
 * @returns JSON response with investigation results
 */
export async function POST(request: NextRequest) {
    const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID()
    const startTime = Date.now()

    try {
        // Parse and validate request body
        const body = await request.json()
        const { investigationId, orgId } = investigateRequestSchema.parse(body)

        const supabaseAdmin = getSupabaseAdmin()

        // Load investigation with retry for transient DB errors
        const investigation = await retryWithBackoff(async () => {
            const { data, error } = await supabaseAdmin
                .from('investigations')
                .select('*')
                .eq('id', investigationId)
                .single()

            if (error || !data) {
                throw new NotFoundError('Investigation', investigationId)
            }

            // Verify investigation belongs to org
            if (data.org_id !== orgId) {
                throw new AppError(
                    'Investigation does not belong to organization',
                    'ORG_MISMATCH',
                    403,
                    { investigationId, orgId, investigationOrgId: data.org_id }
                )
            }

            return data
        })

        // Update status to running (optimistic update)
        await supabaseAdmin
            .from('investigations')
            .update({
                status: 'running',
                started_at: new Date().toISOString(),
            })
            .eq('id', investigationId)

        logger.info('Investigation started', {
            requestId,
            investigationId,
            orgId,
            triggerType: investigation.trigger_type,
        })

        // Load credentials (parallel for performance)
        const credentials = await loadCredentials(orgId, supabaseAdmin, requestId)

        // Build alert context from trigger payload
        const triggerPayload = (investigation.trigger_payload as Record<string, unknown>) || {}
        const alertContext = {
            alertName: String(triggerPayload.alert_title || triggerPayload.title || 'Unknown Alert'),
            alertId: String(triggerPayload.alert_id || investigation.monitor_id || ''),
            service: String(triggerPayload.service || extractServiceFromTags(triggerPayload.tags as string[])),
            severity: String(triggerPayload.alert_transition || triggerPayload.severity || 'unknown'),
            message: String(triggerPayload.body || triggerPayload.message || ''),
            link: String(triggerPayload.link || ''),
            tags: Array.isArray(triggerPayload.tags) ? triggerPayload.tags : [],
        }

        // Run investigation via agent API (this is the expensive operation)
        const agentUrl = process.env.AGENT_API_URL || 'http://127.0.0.1:2024'
        const agentResponse = await fetch(`${agentUrl}/runs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                assistant_id: 'investigation',
                input: {
                    investigation_id: investigationId,
                    org_id: orgId,
                    alert_context: {
                        alert_name: alertContext.alertName,
                        service: alertContext.service,
                        severity: alertContext.severity,
                        message: alertContext.message,
                    },
                    datadog_creds: credentials.datadog ? {
                        api_key: credentials.datadog.apiKey,
                        app_key: credentials.datadog.appKey,
                        site: credentials.datadog.site,
                    } : null,
                    github_creds: credentials.github ? {
                        app_id: credentials.github.appId,
                        private_key: credentials.github.privateKey,
                        installation_id: credentials.github.installationId,
                    } : null,
                    slack_creds: credentials.slack ? {
                        bot_token: credentials.slack.botToken,
                        channel_id: credentials.slack.defaultChannelId,
                    } : null,
                },
            }),
        })

        if (!agentResponse.ok) {
            throw new Error(`Agent API error: ${agentResponse.status}`)
        }

        const agentResult = await agentResponse.json()

        // Map agent response to expected format
        const result = {
            success: agentResult.success ?? true,
            summary: agentResult.summary || 'Investigation complete.',
            rootCause: agentResult.root_cause || null,
            findings: agentResult.findings || [],
            suggestedActions: agentResult.suggested_actions || [],
            confidence: agentResult.confidence || 0.5,
            durationMs: agentResult.duration_ms || (Date.now() - startTime),
            langsmithUrl: agentResult.langsmith_url,
            error: agentResult.error,
        }

        // Update investigation with results
        const updateData: Record<string, unknown> = {
            status: result.success ? 'completed' : 'failed',
            completed_at: new Date().toISOString(),
            duration_ms: result.durationMs,
        }

        if (result.success) {
            updateData.summary = result.summary
            updateData.root_cause = result.rootCause
            updateData.findings = result.findings
            updateData.suggested_actions = result.suggestedActions
            updateData.confidence_score = result.confidence
            if (result.langsmithUrl) {
                updateData.langsmith_url = result.langsmithUrl
            }
        } else {
            updateData.summary = result.error || 'Investigation failed'
        }

        await supabaseAdmin
            .from('investigations')
            .update(updateData)
            .eq('id', investigationId)

        const totalDurationMs = Date.now() - startTime

        logger.info('Investigation completed', {
            requestId,
            investigationId,
            success: result.success,
            durationMs: result.durationMs,
            totalDurationMs,
            confidence: result.confidence,
        })

        return NextResponse.json({
            success: result.success,
            result: result.success ? {
                summary: result.summary,
                rootCause: result.rootCause,
                confidence: result.confidence,
                durationMs: result.durationMs,
            } : {
                error: result.error,
            },
            requestId,
        })
    } catch (error) {
        const totalDurationMs = Date.now() - startTime

        // Handle validation errors
        if (error instanceof ValidationError || error instanceof NotFoundError) {
            logger.warn('Investigation request validation failed', {
                requestId,
                error: error.message,
                code: error.code,
                totalDurationMs,
            })
            return NextResponse.json(
                {
                    error: error.message,
                    code: error.code,
                    requestId,
                },
                { status: error.statusCode }
            )
        }

        logger.error('Investigation failed', {
            requestId,
            error: getErrorMessage(error),
            totalDurationMs,
        })

        // Try to update investigation status to failed (best effort)
        try {
            const body = await request.json().catch(() => ({}))
            const parsed = investigateRequestSchema.safeParse(body)

            if (parsed.success) {
                const supabaseAdmin = getSupabaseAdmin()
                await supabaseAdmin
                    .from('investigations')
                    .update({
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        summary: getErrorMessage(error),
                    })
                    .eq('id', parsed.data.investigationId)
            }
        } catch (updateError) {
            logger.error('Failed to update investigation status after error', {
                requestId,
                error: updateError,
            })
        }

        return NextResponse.json(
            {
                error: 'Investigation failed',
                code: 'INVESTIGATION_FAILED',
                requestId,
            },
            { status: 500 }
        )
    }
}

/**
 * Load encrypted credentials from Supabase Vault
 * Loads credentials in parallel for better performance
 *
 * @param orgId - Organization ID
 * @param supabaseAdmin - Supabase admin client
 * @param requestId - Request ID for logging
 * @returns Credentials object with available integrations
 */
/** Credentials container type */
interface Credentials {
    datadog?: DatadogCredentials
    github?: GitHubCredentials
    slack?: SlackCredentials
}

/**
 * Extract service name from Datadog tags
 */
function extractServiceFromTags(tags?: string[]): string {
    if (!tags || !Array.isArray(tags)) return 'unknown'
    const serviceTag = tags.find((t) => t.startsWith('service:'))
    return serviceTag ? serviceTag.replace('service:', '') : 'unknown'
}

async function loadCredentials(
    orgId: string,
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
    requestId: string
): Promise<Credentials> {
    const credentials: Credentials = {}

    // Load all credentials in parallel for better performance
    const [datadogCreds, githubCreds, slackCreds] = await Promise.allSettled([
        // Datadog credentials
        Promise.all([
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
        ]),
        // GitHub credentials
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', {
                p_org_id: orgId,
                p_provider: 'github',
                p_secret_type: 'installation_id',
            }),
        ]),
        // Slack credentials
        Promise.all([
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
        ]),
    ])

    // Process Datadog credentials
    if (datadogCreds.status === 'fulfilled') {
        const [apiKeyRes, appKeyRes, siteRes] = datadogCreds.value
        const apiKey = apiKeyRes?.data as string | null
        const appKey = appKeyRes?.data as string | null
        const site = siteRes?.data as string | null
        if (apiKey && appKey) {
            credentials.datadog = {
                apiKey,
                appKey,
                site: site || 'datadoghq.com',
            }
            logger.debug('Datadog credentials loaded', { requestId, orgId })
        }
    } else {
        logger.warn('Failed to load Datadog credentials', {
            requestId,
            orgId,
            error: datadogCreds.reason,
        })
    }

    // Process GitHub credentials
    if (githubCreds.status === 'fulfilled') {
        const [installationIdRes] = githubCreds.value
        const installationId = installationIdRes?.data as string | null
        const appId = process.env.GITHUB_APP_ID
        const privateKey = process.env.GITHUB_PRIVATE_KEY

        if (installationId && appId && privateKey) {
            credentials.github = {
                appId,
                privateKey: privateKey.replace(/\\n/g, '\n'),
                installationId: parseInt(installationId, 10),
            }
            logger.debug('GitHub credentials loaded', { requestId, orgId })
        }
    } else {
        logger.warn('Failed to load GitHub credentials', {
            requestId,
            orgId,
            error: githubCreds.reason,
        })
    }

    // Process Slack credentials
    if (slackCreds.status === 'fulfilled') {
        const [botTokenRes, channelIdRes] = slackCreds.value
        const botToken = botTokenRes?.data as string | null
        const channelId = channelIdRes?.data as string | null
        if (botToken && channelId) {
            credentials.slack = {
                botToken,
                defaultChannelId: channelId,
            }
            logger.debug('Slack credentials loaded', { requestId, orgId })
        }
    } else {
        logger.warn('Failed to load Slack credentials', {
            requestId,
            orgId,
            error: slackCreds.reason,
        })
    }

    // Log which integrations are available
    const availableIntegrations = Object.keys(credentials).filter(
        key => credentials[key as keyof typeof credentials] !== undefined
    )
    logger.info('Credentials loaded', {
        requestId,
        orgId,
        availableIntegrations,
    })

    return credentials
}

