import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Vercel Cron configuration
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    )
}

interface MonitoringJob {
    id: string
    org_id: string
    name: string
    job_type: 'deployment_watcher' | 'health_check' | 'error_scanner' | 'baseline_builder' | 'custom'
    schedule_interval: number
    config: Record<string, unknown>
    slack_channel_id: string | null
    notify_on: 'always' | 'issues' | 'never'
}

interface Credentials {
    datadog?: {
        apiKey: string
        appKey: string
        site: string
    }
    github?: {
        appId: string
        privateKey: string
        installationId: number
    }
    slack?: {
        botToken: string
        channelId: string
    }
}

/**
 * Load credentials for an organization
 */
async function loadCredentials(
    orgId: string,
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
): Promise<Credentials> {
    const credentials: Credentials = {}

    const [datadogCreds, githubCreds, slackCreds] = await Promise.allSettled([
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', { p_org_id: orgId, p_provider: 'datadog', p_secret_type: 'api_key' }),
            supabaseAdmin.rpc('get_integration_secret', { p_org_id: orgId, p_provider: 'datadog', p_secret_type: 'app_key' }),
            supabaseAdmin.rpc('get_integration_secret', { p_org_id: orgId, p_provider: 'datadog', p_secret_type: 'site' }),
        ]),
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', { p_org_id: orgId, p_provider: 'github', p_secret_type: 'installation_id' }),
        ]),
        Promise.all([
            supabaseAdmin.rpc('get_integration_secret', { p_org_id: orgId, p_provider: 'slack', p_secret_type: 'bot_token' }),
            supabaseAdmin.rpc('get_integration_secret', { p_org_id: orgId, p_provider: 'slack', p_secret_type: 'channel_id' }),
        ]),
    ])

    if (datadogCreds.status === 'fulfilled') {
        const [apiKeyRes, appKeyRes, siteRes] = datadogCreds.value
        if (apiKeyRes?.data && appKeyRes?.data) {
            credentials.datadog = {
                apiKey: apiKeyRes.data as string,
                appKey: appKeyRes.data as string,
                site: (siteRes?.data as string) || 'datadoghq.com',
            }
        }
    }

    if (githubCreds.status === 'fulfilled') {
        const [installationIdRes] = githubCreds.value
        const appId = process.env.GITHUB_APP_ID
        const privateKey = process.env.GITHUB_PRIVATE_KEY
        if (installationIdRes?.data && appId && privateKey) {
            credentials.github = {
                appId,
                privateKey: privateKey.replace(/\\n/g, '\n'),
                installationId: parseInt(installationIdRes.data as string, 10),
            }
        }
    }

    if (slackCreds.status === 'fulfilled') {
        const [botTokenRes, channelIdRes] = slackCreds.value
        if (botTokenRes?.data && channelIdRes?.data) {
            credentials.slack = {
                botToken: botTokenRes.data as string,
                channelId: channelIdRes.data as string,
            }
        }
    }

    return credentials
}

/**
 * Execute a monitoring job
 */
async function executeJob(
    job: MonitoringJob,
    credentials: Credentials,
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
): Promise<{ success: boolean; summary: string; findings: unknown[]; alertSent: boolean }> {
    const agentUrl = process.env.AGENT_API_URL || 'http://127.0.0.1:2024'

    const structuredOutputInstructions = `

IMPORTANT: At the END of your response, you MUST include a JSON block with your findings in this exact format:

\`\`\`json
{
  "summary": "One sentence summary of what you found",
  "findings": [
    {
      "type": "info|warning|error|success",
      "title": "Short title for this finding",
      "description": "Detailed explanation (optional)",
      "metric": "metric name if applicable (optional)",
      "value": "metric value if applicable (optional)"
    }
  ]
}
\`\`\`

Always include this JSON block, even if findings is an empty array.`

    // Build the prompt based on job type
    let prompt: string
    switch (job.job_type) {
        case 'deployment_watcher':
            prompt = `You are monitoring for new deployments.
Check GitHub for any deployments in the last ${job.schedule_interval * 2} minutes.
For each deployment found:
1. Note the commit SHA, message, author, and time
2. Check if enough time has passed (at least 10 minutes) for metrics to stabilize
3. If yes, compare error rates and latency before vs after the deployment
4. Report any regressions found

If no deployments found, report that with type "info".
If deployments found but no regressions, report deployments with type "success".
If regressions found, report each with type "warning" or "error" based on severity.${structuredOutputInstructions}`
            break

        case 'health_check':
            const services = (job.config.services as string[]) || []
            prompt = `Perform a quick health check on the following services: ${services.length > 0 ? services.join(', ') : 'all monitored services'}.

For each service, check:
1. Current error rate (compare to typical baseline if known)
2. Current P95 latency (compare to typical baseline if known)
3. Any new error patterns in the last 15 minutes

Report each finding with appropriate type:
- "success" for healthy metrics
- "info" for neutral observations
- "warning" for concerning but not critical issues
- "error" for critical issues needing immediate attention${structuredOutputInstructions}`
            break

        case 'error_scanner':
            prompt = `Scan logs for error patterns in the last ${job.schedule_interval} minutes.

1. Search for errors across all services
2. Group similar errors together
3. Identify any NEW error patterns (errors we haven't seen before)
4. Note the frequency and affected services

Report each finding:
- New error patterns with type "error" or "warning"
- Significant increases in known patterns with type "warning"
- If no issues, report type "success" with message "No new error patterns"${structuredOutputInstructions}`
            break

        case 'baseline_builder':
            prompt = `Collect current metrics to update service baselines.

For each active service:
1. Get current error rate
2. Get current latency (P50, P95, P99)
3. Get current request rate
4. Get CPU and memory usage if available

Report each metric as a finding with type "info", including the metric name and value.${structuredOutputInstructions}`
            break

        case 'custom':
            prompt = ((job.config.prompt as string) || 'Perform a general system health check.') + structuredOutputInstructions
            break

        default:
            prompt = 'Perform a general system health check.' + structuredOutputInstructions
    }

    try {
        // Call the agent
        const response = await fetch(`${agentUrl}/runs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                assistant_id: 'investigation',
                input: {
                    messages: [{ role: 'human', content: prompt }],
                    investigation_id: `monitoring-${job.id}-${Date.now()}`,
                    org_id: job.org_id,
                    alert_context: {
                        alert_name: `Scheduled: ${job.name}`,
                        service: 'monitoring',
                        severity: 'info',
                        message: prompt,
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
                        channel_id: job.slack_channel_id || credentials.slack.channelId,
                    } : null,
                    phase: 'monitoring',
                    iteration: 0,
                    max_iterations: 3,
                    recent_deployments: [],
                    affected_services: [],
                    started_at: new Date().toISOString(),
                },
            }),
        })

        if (!response.ok) {
            throw new Error(`Agent API error: ${response.status}`)
        }

        const result = await response.json()

        // Try to extract structured output from the agent's response
        let summary = 'Job completed'
        let findings: unknown[] = []

        // The agent response might have messages array with the final response
        const messages = result.messages || result.output?.messages || []
        const lastMessage = messages[messages.length - 1]
        const responseText = lastMessage?.content || result.output || result.summary || ''

        // Try to extract JSON from the response
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[1])
                summary = parsed.summary || summary
                findings = parsed.findings || []
            } catch {
                // JSON parsing failed, try to extract summary from text
                summary = responseText.replace(/```json[\s\S]*```/g, '').trim().slice(0, 500) || summary
            }
        } else {
            // No JSON block, use the text as summary
            summary = typeof responseText === 'string'
                ? responseText.slice(0, 500)
                : 'Job completed'
        }

        // Determine if we should alert based on findings
        const hasIssues = findings.length > 0 &&
                         findings.some((f: unknown) => {
                             const finding = f as { type?: string }
                             return finding.type === 'error' || finding.type === 'warning'
                         })

        const shouldAlert = job.notify_on === 'always' ||
                           (job.notify_on === 'issues' && hasIssues)

        // If we should alert and have Slack, the agent should have already sent it
        // But we track it here for the run record
        const alertSent = shouldAlert && !!credentials.slack

        return {
            success: true,
            summary,
            findings,
            alertSent,
        }
    } catch (error) {
        return {
            success: false,
            summary: error instanceof Error ? error.message : 'Job execution failed',
            findings: [],
            alertSent: false,
        }
    }
}

/**
 * Cron endpoint - runs every minute, checks for pending jobs
 *
 * Vercel Cron hits this endpoint based on vercel.json configuration
 */
export async function GET(request: NextRequest) {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // In development, allow without auth
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const startTime = Date.now()
    const supabaseAdmin = getSupabaseAdmin()

    try {
        // Get pending jobs
        const { data: pendingJobs, error: jobsError } = await supabaseAdmin
            .rpc('get_pending_monitoring_jobs')

        if (jobsError) {
            console.error('Failed to get pending jobs:', jobsError)
            return NextResponse.json({ error: 'Failed to get pending jobs' }, { status: 500 })
        }

        if (!pendingJobs || pendingJobs.length === 0) {
            return NextResponse.json({
                message: 'No pending jobs',
                duration_ms: Date.now() - startTime
            })
        }

        console.log(`[Cron] Found ${pendingJobs.length} pending jobs`)

        const results = []

        for (const job of pendingJobs as MonitoringJob[]) {
            const jobStartTime = Date.now()

            // Create run record
            const { data: run, error: runError } = await supabaseAdmin
                .from('monitoring_job_runs')
                .insert({
                    job_id: job.id,
                    org_id: job.org_id,
                    status: 'running',
                    started_at: new Date().toISOString(),
                })
                .select()
                .single()

            if (runError || !run) {
                console.error(`Failed to create run for job ${job.id}:`, runError)
                continue
            }

            try {
                // Load credentials for this org
                const credentials = await loadCredentials(job.org_id, supabaseAdmin)

                // Execute the job
                const result = await executeJob(job, credentials, supabaseAdmin)

                // Update run record
                await supabaseAdmin
                    .from('monitoring_job_runs')
                    .update({
                        status: result.success ? 'completed' : 'failed',
                        summary: result.summary,
                        findings: result.findings,
                        alert_sent: result.alertSent,
                        completed_at: new Date().toISOString(),
                        duration_ms: Date.now() - jobStartTime,
                    })
                    .eq('id', run.id)

                // Update job tracking
                await supabaseAdmin.rpc('update_job_after_run', {
                    p_job_id: job.id,
                    p_success: result.success,
                })

                results.push({
                    job_id: job.id,
                    job_name: job.name,
                    success: result.success,
                    duration_ms: Date.now() - jobStartTime,
                })

                console.log(`[Cron] Job ${job.name} completed: ${result.success ? 'success' : 'failed'}`)

            } catch (error) {
                // Update run as failed
                await supabaseAdmin
                    .from('monitoring_job_runs')
                    .update({
                        status: 'failed',
                        error_message: error instanceof Error ? error.message : 'Unknown error',
                        completed_at: new Date().toISOString(),
                        duration_ms: Date.now() - jobStartTime,
                    })
                    .eq('id', run.id)

                await supabaseAdmin.rpc('update_job_after_run', {
                    p_job_id: job.id,
                    p_success: false,
                })

                results.push({
                    job_id: job.id,
                    job_name: job.name,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                })

                console.error(`[Cron] Job ${job.name} failed:`, error)
            }
        }

        return NextResponse.json({
            message: `Processed ${results.length} jobs`,
            results,
            duration_ms: Date.now() - startTime,
        })

    } catch (error) {
        console.error('[Cron] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Cron execution failed' },
            { status: 500 }
        )
    }
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
    return GET(request)
}
