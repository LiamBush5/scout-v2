/**
 * Prompt templates for monitoring jobs
 *
 * Centralized prompt generation for consistent agent behavior.
 */

import type { JobType } from './types'

const STRUCTURED_OUTPUT_INSTRUCTIONS = `

IMPORTANT: At the END of your response, include a JSON block with findings:

\`\`\`json
{
  "summary": "One sentence summary",
  "findings": [
    {
      "type": "info|warning|error|success",
      "title": "Short title",
      "description": "Details (optional)",
      "metric": "metric name (optional)",
      "value": "metric value (optional)"
    }
  ]
}
\`\`\`

Always include this JSON block, even if findings is empty.`

interface PromptConfig {
    jobType: JobType
    scheduleInterval: number
    config: Record<string, unknown>
}

/**
 * Generate a prompt for a monitoring job based on its type
 */
export function generatePrompt({ jobType, scheduleInterval, config }: PromptConfig): string {
    switch (jobType) {
        case 'deployment_watcher':
            return generateDeploymentWatcherPrompt(scheduleInterval)

        case 'health_check':
            return generateHealthCheckPrompt(config)

        case 'error_scanner':
            return generateErrorScannerPrompt(scheduleInterval)

        case 'baseline_builder':
            return generateBaselineBuilderPrompt()

        case 'custom':
            return generateCustomPrompt(config)

        default:
            return 'Perform a general system health check.' + STRUCTURED_OUTPUT_INSTRUCTIONS
    }
}

function generateDeploymentWatcherPrompt(scheduleInterval: number): string {
    return `You are monitoring for new deployments.

Check GitHub for any deployments in the last ${scheduleInterval * 2} minutes.

For each deployment found:
1. Note the commit SHA, message, author, and time
2. Check if enough time has passed (at least 10 minutes) for metrics to stabilize
3. If yes, compare error rates and latency before vs after the deployment
4. Report any regressions found

Findings:
- No deployments: type "info"
- Deployments with no regressions: type "success"
- Regressions found: type "warning" or "error" based on severity${STRUCTURED_OUTPUT_INSTRUCTIONS}`
}

function generateHealthCheckPrompt(config: Record<string, unknown>): string {
    const services = (config.services as string[]) || []
    const serviceList = services.length > 0 ? services.join(', ') : 'all monitored services'

    return `Perform a health check on: ${serviceList}

For each service, check:
1. Current error rate (compare to baseline if known)
2. Current P95 latency (compare to baseline if known)
3. Any new error patterns in the last 15 minutes

Findings:
- Healthy metrics: type "success"
- Neutral observations: type "info"
- Concerning but not critical: type "warning"
- Critical issues: type "error"${STRUCTURED_OUTPUT_INSTRUCTIONS}`
}

function generateErrorScannerPrompt(scheduleInterval: number): string {
    return `Scan logs for error patterns in the last ${scheduleInterval} minutes.

1. Search for errors across all services
2. Group similar errors together
3. Identify NEW error patterns (not seen before)
4. Note the frequency and affected services

Findings:
- New error patterns: type "error" or "warning"
- Significant increases: type "warning"
- No issues: type "success" with "No new error patterns"${STRUCTURED_OUTPUT_INSTRUCTIONS}`
}

function generateBaselineBuilderPrompt(): string {
    return `Collect current metrics for service baselines.

For each active service:
1. Get current error rate
2. Get current latency (P50, P95, P99)
3. Get current request rate
4. Get CPU and memory usage if available

Report each metric as a finding with type "info".${STRUCTURED_OUTPUT_INSTRUCTIONS}`
}

function generateCustomPrompt(config: Record<string, unknown>): string {
    const customPrompt = (config.prompt as string) || 'Perform a general system health check.'
    return customPrompt + STRUCTURED_OUTPUT_INSTRUCTIONS
}
