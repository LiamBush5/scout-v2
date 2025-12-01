/**
 * Datadog Tools for LangGraph Agent
 *
 * Tools for querying Datadog metrics, logs, monitors, and events.
 */

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { v1, v2, client } from '@datadog/datadog-api-client'
import type { DatadogCredentials } from '../types'

/**
 * Create Datadog tools with the provided credentials
 */
export function createDatadogTools(credentials: DatadogCredentials) {
    const configuration = client.createConfiguration({
        authMethods: {
            apiKeyAuth: credentials.apiKey,
            appKeyAuth: credentials.appKey,
        },
    })
    configuration.setServerVariables({ site: credentials.site })

    const metricsApi = new v1.MetricsApi(configuration)
    const logsApi = new v2.LogsApi(configuration)
    const monitorsApi = new v1.MonitorsApi(configuration)
    const eventsApi = new v1.EventsApi(configuration)

    // =========================================================================
    // Query Metrics Tool
    // =========================================================================
    const queryMetrics = tool(
        async ({ query, minutesBack }) => {
            const now = Math.floor(Date.now() / 1000)
            const from = now - minutesBack * 60

            try {
                const response = await metricsApi.queryMetrics({ from, to: now, query })
                const series = response.series || []

                const results = series.map((s) => {
                    const points = s.pointlist || []
                    const values = points.map((p) => p[1]).filter((v): v is number => v !== null)

                    return {
                        scope: s.scope,
                        metric: s.metric,
                        latestValue: values[values.length - 1] ?? null,
                        min: values.length ? Math.min(...values) : null,
                        max: values.length ? Math.max(...values) : null,
                        avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
                        trend:
                            values.length >= 2
                                ? values[values.length - 1] > values[0] * 1.2
                                    ? '📈 increasing'
                                    : values[values.length - 1] < values[0] * 0.8
                                        ? '📉 decreasing'
                                        : '➡️ stable'
                                : 'insufficient data',
                    }
                })

                return JSON.stringify({ success: true, query, results }, null, 2)
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'query_datadog_metrics',
            description: `Query Datadog metrics. Common patterns:
- avg:system.cpu.user{host:web-*} - CPU usage
- sum:trace.http.request.errors{service:api}.as_rate() - Error rate
- p95:trace.http.request.duration{service:api} - P95 latency`,
            schema: z.object({
                query: z.string().describe('Datadog metric query'),
                minutesBack: z.number().default(30).describe('Minutes of data to fetch'),
            }),
        }
    )

    // =========================================================================
    // Search Logs Tool
    // =========================================================================
    const searchLogs = tool(
        async ({ query, minutesBack, limit }) => {
            try {
                const response = await logsApi.listLogs({
                    body: {
                        filter: { query, from: `now-${minutesBack}m`, to: 'now' },
                        sort: '-timestamp' as const,
                        page: { limit },
                    },
                })

                const logs = (response.data || []).map((log) => ({
                    timestamp: log.attributes?.timestamp,
                    service: log.attributes?.service,
                    status: log.attributes?.status,
                    message: (log.attributes?.message as string)?.slice(0, 500),
                }))

                // Extract error patterns
                const errorMessages = logs
                    .filter((l) => l.status === 'error' || l.status === 'critical')
                    .map((l) => l.message)
                    .filter(Boolean)

                const topErrors = getTopPatterns(errorMessages as string[], 3)

                return JSON.stringify(
                    {
                        success: true,
                        query,
                        count: logs.length,
                        topErrors,
                        logs: logs.slice(0, 10),
                    },
                    null,
                    2
                )
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'search_datadog_logs',
            description: `Search Datadog logs. Examples:
- service:api status:error - Errors from a service
- @http.status_code:[500 TO 599] - HTTP 5xx errors`,
            schema: z.object({
                query: z.string().describe('Datadog log query'),
                minutesBack: z.number().default(30),
                limit: z.number().default(50),
            }),
        }
    )

    // =========================================================================
    // Get Monitor Details Tool
    // =========================================================================
    const getMonitorDetails = tool(
        async ({ monitorId }) => {
            try {
                const monitor = await monitorsApi.getMonitor({ monitorId })

                let interpretation = 'Custom monitor'
                const query = monitor.query || ''
                if (query.toLowerCase().includes('duration')) interpretation = 'LATENCY monitor'
                else if (query.toLowerCase().includes('error')) interpretation = 'ERROR RATE monitor'
                else if (query.toLowerCase().includes('cpu')) interpretation = 'CPU monitor'
                else if (query.toLowerCase().includes('mem')) interpretation = 'MEMORY monitor'

                return JSON.stringify(
                    {
                        success: true,
                        monitor: {
                            id: monitor.id,
                            name: monitor.name,
                            type: monitor.type,
                            query: monitor.query,
                            overallState: monitor.overallState,
                            tags: monitor.tags,
                        },
                        interpretation,
                    },
                    null,
                    2
                )
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'get_datadog_monitor',
            description: 'Get details about a specific Datadog monitor by ID',
            schema: z.object({
                monitorId: z.number().describe('The Datadog monitor ID'),
            }),
        }
    )

    // =========================================================================
    // Get APM Service Summary Tool
    // =========================================================================
    const getApmServiceSummary = tool(
        async ({ serviceName, env, minutesBack }) => {
            const now = Math.floor(Date.now() / 1000)
            const from = now - minutesBack * 60

            const queries = {
                errorRate: `sum:trace.http.request.errors{service:${serviceName},env:${env}}.as_rate()`,
                latencyP95: `p95:trace.http.request.duration{service:${serviceName},env:${env}}`,
                throughput: `sum:trace.http.request.hits{service:${serviceName},env:${env}}.as_rate()`,
            }

            const results: Record<string, number | null> = {}
            const issues: string[] = []

            for (const [name, query] of Object.entries(queries)) {
                try {
                    const response = await metricsApi.queryMetrics({ from, to: now, query })
                    const points = response.series?.[0]?.pointlist || []
                    const values = points.map((p) => p[1]).filter((v): v is number => v !== null)
                    let current = values[values.length - 1] ?? null

                    // Convert latency from ns to ms
                    if (name === 'latencyP95' && current && current > 1000000) {
                        current = current / 1000000
                    }

                    results[name] = current ? Math.round(current * 100) / 100 : null

                    // Detect issues
                    if (name === 'errorRate' && current && current > 0.01) {
                        issues.push(`🔴 High error rate: ${(current * 100).toFixed(2)}%`)
                    }
                    if (name === 'latencyP95' && current && current > 500) {
                        issues.push(`🟡 High P95 latency: ${Math.round(current)}ms`)
                    }
                } catch {
                    results[name] = null
                }
            }

            const summary =
                issues.length > 0 ? `⚠️ ISSUES: ${issues.join('; ')}` : '✅ Service appears healthy'

            return JSON.stringify(
                {
                    success: true,
                    service: serviceName,
                    env,
                    summary,
                    metrics: results,
                    issues,
                },
                null,
                2
            )
        },
        {
            name: 'get_apm_service_summary',
            description: 'Get APM summary (error rate, latency, throughput) for a service',
            schema: z.object({
                serviceName: z.string().describe('Service name in Datadog APM'),
                env: z.string().default('prod'),
                minutesBack: z.number().default(60),
            }),
        }
    )

    // =========================================================================
    // Get Datadog Events Tool
    // =========================================================================
    const getDatadogEvents = tool(
        async ({ hoursBack, tags }) => {
            try {
                const now = Math.floor(Date.now() / 1000)
                const start = now - hoursBack * 3600

                const response = await eventsApi.listEvents({
                    start,
                    end: now,
                    tags: tags?.join(','),
                })

                const events = (response.events || []).map((event) => ({
                    title: (event.title || '').slice(0, 100),
                    timestamp: event.dateHappened
                        ? new Date(event.dateHappened * 1000).toISOString()
                        : null,
                    sourceType: event.sourceTypeName,
                    tags: event.tags,
                }))

                const deployments = events.filter(
                    (e) =>
                        (e.sourceType &&
                            ['deployment', 'github', 'jenkins', 'circleci'].includes(e.sourceType)) ||
                        e.title.toLowerCase().includes('deploy')
                )

                const summary =
                    deployments.length > 0
                        ? `🚨 ${deployments.length} DEPLOYMENTS found`
                        : `No deployments. ${events.length} total events.`

                return JSON.stringify(
                    {
                        success: true,
                        summary,
                        deployments: deployments.slice(0, 10),
                        allEvents: events.slice(0, 20),
                    },
                    null,
                    2
                )
            } catch (error) {
                return JSON.stringify({ success: false, error: String(error) })
            }
        },
        {
            name: 'get_datadog_events',
            description: 'Get recent Datadog events including deployments and config changes',
            schema: z.object({
                hoursBack: z.number().default(4),
                tags: z.array(z.string()).optional().describe('Filter by tags'),
            }),
        }
    )

    return [queryMetrics, searchLogs, getMonitorDetails, getApmServiceSummary, getDatadogEvents]
}

/**
 * Extract top recurring patterns from a list of messages
 */
function getTopPatterns(messages: string[], topN: number = 3): string[] {
    if (!messages.length) return []

    const patterns: Record<string, number> = {}
    for (const msg of messages) {
        const key = msg.slice(0, 50)
        patterns[key] = (patterns[key] || 0) + 1
    }

    return Object.entries(patterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN)
        .map(([pattern, count]) => `${pattern}... (${count}x)`)
}

