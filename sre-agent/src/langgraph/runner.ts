/**
 * Investigation Runner
 *
 * Entry point for running investigations.
 * Handles graph invocation, result extraction, and tracing.
 */

import { traceable } from 'langsmith/traceable'
import { createInvestigationGraph, type AlertContext } from './graph'
import { PHASES, TRACING_CONFIG, AGENT_LIMITS } from './config'
import type {
    DatadogCredentials,
    GitHubCredentials,
    SlackCredentials,
    InvestigationResult,
    DeploymentInfo,
} from './types'

// =============================================================================
// Types
// =============================================================================

/** Input parameters for running an investigation */
export interface RunInvestigationParams {
    /** Unique ID for this investigation */
    investigationId: string
    /** Organization ID for multi-tenancy */
    orgId: string
    /** Alert context from the trigger */
    alertContext: AlertContext
    /** Datadog API credentials */
    datadogCreds?: DatadogCredentials | null
    /** GitHub App credentials */
    githubCreds?: GitHubCredentials | null
    /** Slack Bot credentials */
    slackCreds?: SlackCredentials | null
}

// =============================================================================
// Main Runner
// =============================================================================

/**
 * Run a complete investigation.
 *
 * This is the main entry point for the investigation agent.
 * It creates the graph, invokes it with initial state, and extracts results.
 *
 * @example
 * ```ts
 * const result = await runInvestigation({
 *   investigationId: 'inv_123',
 *   orgId: 'org_456',
 *   alertContext: {
 *     alertName: 'High Error Rate',
 *     service: 'api-gateway',
 *     severity: 'critical',
 *     message: 'Error rate exceeded 5% threshold',
 *   },
 *   datadogCreds: { apiKey: '...', appKey: '...', site: 'datadoghq.com' },
 *   githubCreds: { appId: '...', privateKey: '...', installationId: 123 },
 *   slackCreds: { botToken: '...', defaultChannelId: 'C123' },
 * })
 * ```
 */
export const runInvestigation = traceable(
    async function runInvestigation(params: RunInvestigationParams): Promise<InvestigationResult> {
        const {
            investigationId,
            orgId,
            alertContext,
            datadogCreds = null,
            githubCreds = null,
            slackCreds = null,
        } = params

        const startTime = Date.now()
        let toolCallCount = 0

        try {
            // Create the investigation graph
            const graph = createInvestigationGraph(datadogCreds, githubCreds, slackCreds)

            // Initial state - only pass required fields, let defaults handle the rest
            const initialState = {
                investigationId,
                orgId,
                alertContext,
                datadogCreds,
                githubCreds,
                slackCreds,
                affectedServices: alertContext.service ? [alertContext.service] : [],
                startedAt: new Date().toISOString(),
            }

            // Run the graph
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const finalState = await graph.invoke(initialState as any)

            // Extract results
            const messages = finalState.messages || []
            toolCallCount = finalState.iteration || 0
            const deploymentsFound = (finalState.recentDeployments || []) as DeploymentInfo[]

            // Find the final summary from the last AI message without tool calls
            let summary = 'Investigation complete.'
            let rootCause: string | null = null
            let confidence = 0.5

            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i]
                if (
                    msg &&
                    'content' in msg &&
                    typeof msg.content === 'string' &&
                    msg.content.length > 50 &&
                    !('tool_calls' in msg && (msg as { tool_calls?: unknown[] }).tool_calls?.length)
                ) {
                    summary = msg.content
                    // Try to extract root cause and confidence from the summary
                    const rootCauseMatch = summary.match(
                        /root cause[:\s]+([^.]+)/i
                    )
                    if (rootCauseMatch) {
                        rootCause = rootCauseMatch[1].trim()
                    }
                    if (summary.toLowerCase().includes('high confidence')) {
                        confidence = 0.85
                    } else if (summary.toLowerCase().includes('medium confidence')) {
                        confidence = 0.6
                    } else if (summary.toLowerCase().includes('low confidence')) {
                        confidence = 0.35
                    }
                    break
                }
            }

            return {
                success: true,
                summary,
                rootCause,
                findings: [],
                suggestedActions: [],
                confidence,
                durationMs: Date.now() - startTime,
                toolCalls: toolCallCount,
                deploymentsFound,
            }
        } catch (error) {
            console.error('Investigation failed:', error)
            return {
                success: false,
                summary: 'Investigation failed due to an error.',
                rootCause: null,
                findings: [],
                suggestedActions: [],
                confidence: 0,
                durationMs: Date.now() - startTime,
                toolCalls: toolCallCount,
                deploymentsFound: [],
                error: error instanceof Error ? error.message : String(error),
            }
        }
    },
    {
        name: 'run_investigation',
        run_type: 'chain',
        tags: TRACING_CONFIG.DEFAULT_TAGS,
    }
)

/**
 * Run investigation synchronously (for environments without top-level await)
 */
export function runInvestigationSync(params: RunInvestigationParams): Promise<InvestigationResult> {
    return runInvestigation(params)
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Create alert context from a Datadog webhook payload
 */
export function alertContextFromDatadogWebhook(payload: Record<string, unknown>): AlertContext {
    return {
        alertName: String(payload.alert_title || payload.title || 'Unknown Alert'),
        alertId: String(payload.alert_id || payload.id || ''),
        service: String(payload.service || extractServiceFromTags(payload.tags as string[])),
        severity: String(payload.alert_transition || payload.severity || 'unknown'),
        message: String(payload.body || payload.message || ''),
        link: String(payload.link || ''),
        tags: Array.isArray(payload.tags) ? payload.tags : [],
    }
}

/**
 * Extract service name from Datadog tags
 */
function extractServiceFromTags(tags?: string[]): string {
    if (!tags || !Array.isArray(tags)) return 'unknown'
    const serviceTag = tags.find((t) => t.startsWith('service:'))
    return serviceTag ? serviceTag.replace('service:', '') : 'unknown'
}

