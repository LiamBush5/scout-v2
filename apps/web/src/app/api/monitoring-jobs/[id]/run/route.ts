import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
    return createAdminClient(
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

/**
 * POST /api/monitoring-jobs/[id]/run - Manually trigger a monitoring job
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the job
        const { data: job, error: jobError } = await supabase
            .from('monitoring_jobs')
            .select('*')
            .eq('id', id)
            .single()

        if (jobError || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        const supabaseAdmin = getSupabaseAdmin()

        // Create a run record
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
            console.error('Failed to create run:', runError)
            return NextResponse.json({ error: 'Failed to start job' }, { status: 500 })
        }

        // Load credentials
        const credentials = await loadCredentials(job.org_id, supabaseAdmin)

        // Execute the job in the background
        executeJobAsync(job, credentials, run.id, supabaseAdmin).catch(error => {
            console.error('Job execution failed:', error)
        })

        return NextResponse.json({
            message: 'Job started',
            run_id: run.id,
        })

    } catch (error) {
        console.error('Error triggering monitoring job:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

interface Credentials {
    datadog?: { apiKey: string; appKey: string; site: string }
    github?: { appId: string; privateKey: string; installationId: number }
    slack?: { botToken: string; channelId: string }
}

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

interface MonitoringJob {
    id: string
    org_id: string
    name: string
    job_type: string
    schedule_interval: number
    config: Record<string, unknown>
    slack_channel_id: string | null
    notify_on: string
}

async function executeJobAsync(
    job: MonitoringJob,
    credentials: Credentials,
    runId: string,
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
    const startTime = Date.now()
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

    // Build prompt based on job type
    let prompt: string
    switch (job.job_type) {
        case 'deployment_watcher':
            prompt = `Check GitHub for any deployments in the last ${job.schedule_interval * 2} minutes. For each deployment, compare error rates and latency before vs after. Report any regressions.${structuredOutputInstructions}`
            break
        case 'health_check':
            const services = (job.config.services as string[]) || []
            prompt = `Quick health check on ${services.length > 0 ? services.join(', ') : 'all services'}. Check error rates, latency, and new error patterns. Report each finding with type "success" for healthy, "warning" for concerning, "error" for critical.${structuredOutputInstructions}`
            break
        case 'error_scanner':
            prompt = `Scan logs for error patterns in the last ${job.schedule_interval} minutes. Identify NEW error patterns and significant increases. Skip routine errors.${structuredOutputInstructions}`
            break
        case 'baseline_builder':
            prompt = `Collect current metrics for all services: error rate, latency (P50, P95, P99), request rate. Report each metric as a finding with type "info".${structuredOutputInstructions}`
            break
        case 'custom':
            prompt = ((job.config.prompt as string) || 'Perform a general system health check.') + structuredOutputInstructions
            break
        default:
            prompt = 'Perform a general system health check.' + structuredOutputInstructions
    }

    try {
        // Start the run
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
                        alert_name: `Manual: ${job.name}`,
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

        const runData = await response.json()
        const agentRunId = runData.run_id
        const threadId = runData.thread_id

        if (!agentRunId || !threadId) {
            throw new Error('No run_id or thread_id returned from agent')
        }

        // Poll for completion (max 5 minutes)
        const maxWaitTime = 5 * 60 * 1000
        const pollInterval = 2000
        const startPollTime = Date.now()
        let finalOutput = null

        while (Date.now() - startPollTime < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval))

            // Check run status
            const statusResponse = await fetch(`${agentUrl}/runs/${agentRunId}`, {
                headers: { 'Content-Type': 'application/json' },
            })

            if (!statusResponse.ok) {
                continue
            }

            const statusData = await statusResponse.json()

            if (statusData.status === 'success' || statusData.status === 'error') {
                // Get the thread state to get messages
                const stateResponse = await fetch(`${agentUrl}/threads/${threadId}/state`, {
                    headers: { 'Content-Type': 'application/json' },
                })

                if (stateResponse.ok) {
                    const stateData = await stateResponse.json()
                    finalOutput = stateData.values || stateData
                }
                break
            } else if (statusData.status === 'error' || statusData.status === 'timeout') {
                throw new Error(`Agent run failed with status: ${statusData.status}`)
            }
        }

        // Try to extract structured output from the agent's response
        let summary = 'Job completed'
        let findings: unknown[] = []

        if (finalOutput) {
            // The agent response should have messages array
            const messages = finalOutput.messages || []
            // Get the last AI message
            const aiMessages = messages.filter((m: { type?: string }) => m.type === 'ai' || m.type === 'AIMessage')
            const lastMessage = aiMessages[aiMessages.length - 1]
            const responseText = lastMessage?.content || ''

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
            } else if (typeof responseText === 'string' && responseText.length > 0) {
                // No JSON block, use the text as summary
                summary = responseText.slice(0, 500)
            }
        }

        await supabaseAdmin
            .from('monitoring_job_runs')
            .update({
                status: 'completed',
                summary,
                findings,
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
            })
            .eq('id', runId)

    } catch (error) {
        await supabaseAdmin
            .from('monitoring_job_runs')
            .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
            })
            .eq('id', runId)
    }
}
