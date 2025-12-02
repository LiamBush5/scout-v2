/**
 * Job execution logic for monitoring jobs
 *
 * Handles agent communication, polling, and result parsing.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import type { MonitoringJob, Credentials, Finding, JobExecutionResult } from './types'
import { generatePrompt } from './prompts'

const AGENT_URL = process.env.AGENT_API_URL || 'http://127.0.0.1:2024'
const MAX_POLL_TIME_MS = 5 * 60 * 1000 // 5 minutes
const POLL_INTERVAL_MS = 2000

/**
 * Execute a monitoring job and update the run record
 */
export async function executeJob(
    job: MonitoringJob,
    credentials: Credentials,
    runId: string,
    supabaseAdmin: SupabaseClient
): Promise<void> {
    const startTime = Date.now()

    try {
        const result = await runAgent(job, credentials)

        await supabaseAdmin
            .from('monitoring_job_runs')
            .update({
                status: 'completed',
                summary: result.summary,
                findings: result.findings,
                alert_sent: result.alertSent,
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
            })
            .eq('id', runId)

        // Update job success tracking
        await supabaseAdmin.rpc('update_job_after_run', {
            p_job_id: job.id,
            p_success: true,
        })
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

        // Update job failure tracking
        await supabaseAdmin.rpc('update_job_after_run', {
            p_job_id: job.id,
            p_success: false,
        })
    }
}

/**
 * Run the agent and wait for completion
 */
async function runAgent(
    job: MonitoringJob,
    credentials: Credentials
): Promise<JobExecutionResult> {
    const prompt = generatePrompt({
        jobType: job.job_type,
        scheduleInterval: job.schedule_interval,
        config: job.config,
    })

    // Start the agent run
    const response = await fetch(`${AGENT_URL}/runs`, {
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
                datadog_creds: credentials.datadog
                    ? {
                          api_key: credentials.datadog.apiKey,
                          app_key: credentials.datadog.appKey,
                          site: credentials.datadog.site,
                      }
                    : null,
                github_creds: credentials.github
                    ? {
                          app_id: credentials.github.appId,
                          private_key: credentials.github.privateKey,
                          installation_id: credentials.github.installationId,
                      }
                    : null,
                slack_creds: credentials.slack
                    ? {
                          bot_token: credentials.slack.botToken,
                          channel_id: job.slack_channel_id || credentials.slack.channelId,
                      }
                    : null,
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
    const { run_id: agentRunId, thread_id: threadId } = runData

    if (!agentRunId || !threadId) {
        throw new Error('No run_id or thread_id returned from agent')
    }

    // Poll for completion
    const finalOutput = await pollForCompletion(agentRunId, threadId)

    // Parse the response
    const { summary, findings } = parseAgentResponse(finalOutput)

    // Determine if alert should be sent
    const hasIssues = findings.some((f) => f.type === 'error' || f.type === 'warning')
    const shouldAlert = job.notify_on === 'always' || (job.notify_on === 'issues' && hasIssues)
    const alertSent = shouldAlert && !!credentials.slack

    return { success: true, summary, findings, alertSent }
}

/**
 * Poll the agent for run completion
 */
async function pollForCompletion(
    agentRunId: string,
    threadId: string
): Promise<Record<string, unknown> | null> {
    const startPollTime = Date.now()

    while (Date.now() - startPollTime < MAX_POLL_TIME_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

        const statusResponse = await fetch(`${AGENT_URL}/runs/${agentRunId}`, {
            headers: { 'Content-Type': 'application/json' },
        })

        if (!statusResponse.ok) {
            continue
        }

        const statusData = await statusResponse.json()

        if (statusData.status === 'success') {
            const stateResponse = await fetch(`${AGENT_URL}/threads/${threadId}/state`, {
                headers: { 'Content-Type': 'application/json' },
            })

            if (stateResponse.ok) {
                const stateData = await stateResponse.json()
                return stateData.values || stateData
            }
            return null
        }

        if (statusData.status === 'error' || statusData.status === 'timeout') {
            throw new Error(`Agent run failed: ${statusData.status}`)
        }
    }

    throw new Error('Agent run timed out')
}

/**
 * Parse structured output from agent response
 */
function parseAgentResponse(output: Record<string, unknown> | null): {
    summary: string
    findings: Finding[]
} {
    let summary = 'Job completed'
    let findings: Finding[] = []

    if (!output) {
        return { summary, findings }
    }

    // Extract the last AI message
    const messages = (output.messages as Array<{ type?: string; content?: string }>) || []
    const aiMessages = messages.filter((m) => m.type === 'ai' || m.type === 'AIMessage')
    const lastMessage = aiMessages[aiMessages.length - 1]
    const responseText = lastMessage?.content || ''

    // Try to extract JSON block
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1])
            summary = parsed.summary || summary
            findings = (parsed.findings as Finding[]) || []
        } catch {
            // JSON parsing failed, use text as summary
            summary = responseText.replace(/```json[\s\S]*```/g, '').trim().slice(0, 500) || summary
        }
    } else if (typeof responseText === 'string' && responseText.length > 0) {
        summary = responseText.slice(0, 500)
    }

    return { summary, findings }
}
