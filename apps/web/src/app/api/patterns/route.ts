import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserOrg } from '@/lib/auth/helpers'

interface PatternData {
    type: 'recurring_cause' | 'time_pattern' | 'deployment_correlation' | 'service_hotspot'
    title: string
    description: string
    severity: 'high' | 'medium' | 'low'
    suggestion: string
    incidents: number
    services?: string[]
}

/**
 * GET /api/patterns - Detect patterns from past investigations
 *
 * Query params:
 *   - days_back: number of days to analyze (default: 30)
 *   - service: filter to a specific service
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const daysBack = parseInt(searchParams.get('days_back') || '30')
        const serviceFilter = searchParams.get('service')

        const supabase = await createClient()
        const auth = await getUserOrg(supabase)
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // Fetch completed investigations
        const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

        let query = supabase
            .from('investigations')
            .select('id, service, alert_name, severity, root_cause, confidence_score, created_at, deployments_found')
            .eq('org_id', auth.orgId)
            .eq('status', 'completed')
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })

        if (serviceFilter) {
            query = query.ilike('service', `%${serviceFilter}%`)
        }

        const { data: investigations } = await query

        if (!investigations || investigations.length < 2) {
            return NextResponse.json({
                patterns: [],
                message: 'Not enough data to detect patterns. Need at least 2 completed investigations.',
                total_analyzed: investigations?.length || 0,
                days_analyzed: daysBack,
            })
        }

        const patterns: PatternData[] = []

        // Pattern 1: Recurring root causes
        const rootCauses: Record<string, { incidents: number; services: Set<string>; fullCauses: string[] }> = {}

        for (const inc of investigations) {
            const rc = (inc.root_cause || '').toLowerCase()
            if (rc.length < 10) continue

            for (const keyword of ['connection pool', 'memory leak', 'timeout', 'rate limit',
                'database', 'cache', 'deployment', 'configuration', 'cpu',
                'disk', 'network', 'authentication', 'certificate', 'oom']) {
                if (rc.includes(keyword)) {
                    const key = keyword.replace(' ', '_')
                    if (!rootCauses[key]) {
                        rootCauses[key] = { incidents: 0, services: new Set(), fullCauses: [] }
                    }
                    rootCauses[key].incidents++
                    if (inc.service) rootCauses[key].services.add(inc.service)
                    if (inc.root_cause) rootCauses[key].fullCauses.push(inc.root_cause)
                }
            }
        }

        // Convert recurring causes to patterns
        for (const [cause, data] of Object.entries(rootCauses)) {
            if (data.incidents >= 2) {
                const suggestion = getSuggestionForCause(cause)
                patterns.push({
                    type: 'recurring_cause',
                    title: `Recurring: ${cause.replace(/_/g, ' ')}`,
                    description: `${data.incidents} incidents in the past ${daysBack} days with ${cause.replace(/_/g, ' ')} issues`,
                    severity: data.incidents >= 5 ? 'high' : data.incidents >= 3 ? 'medium' : 'low',
                    suggestion,
                    incidents: data.incidents,
                    services: Array.from(data.services),
                })
            }
        }

        // Pattern 2: Time-based patterns
        let businessHours = 0
        let offHours = 0

        for (const inc of investigations) {
            const hour = new Date(inc.created_at).getHours()
            if (hour >= 9 && hour <= 17) {
                businessHours++
            } else {
                offHours++
            }
        }

        if (businessHours > offHours * 2 && businessHours > 3) {
            patterns.push({
                type: 'time_pattern',
                title: 'Business hours spike',
                description: `${businessHours} of ${investigations.length} incidents occur during business hours (9am-5pm)`,
                severity: 'medium',
                suggestion: 'Issues may be load-related. Review autoscaling thresholds and capacity planning.',
                incidents: businessHours,
            })
        }

        if (offHours > businessHours * 2 && offHours > 3) {
            patterns.push({
                type: 'time_pattern',
                title: 'Off-hours spike',
                description: `${offHours} of ${investigations.length} incidents occur outside business hours`,
                severity: 'medium',
                suggestion: 'Check for scheduled jobs, batch processes, or maintenance windows causing issues.',
                incidents: offHours,
            })
        }

        // Pattern 3: Deployment correlation
        let deployRelated = 0
        for (const inc of investigations) {
            const deploys = inc.deployments_found as unknown[]
            if (Array.isArray(deploys) && deploys.length > 0) {
                deployRelated++
            }
        }

        if (deployRelated > investigations.length * 0.5) {
            patterns.push({
                type: 'deployment_correlation',
                title: 'High deployment correlation',
                description: `${deployRelated} of ${investigations.length} incidents (${Math.round(deployRelated / investigations.length * 100)}%) had recent deployments`,
                severity: deployRelated / investigations.length > 0.7 ? 'high' : 'medium',
                suggestion: 'Strengthen pre-deploy testing. Consider implementing staged rollouts or canary deployments.',
                incidents: deployRelated,
            })
        }

        // Pattern 4: Service hotspots
        const byService: Record<string, number> = {}
        for (const inc of investigations) {
            const svc = inc.service || 'unknown'
            byService[svc] = (byService[svc] || 0) + 1
        }

        for (const [svc, count] of Object.entries(byService)) {
            if (count >= 3) {
                patterns.push({
                    type: 'service_hotspot',
                    title: `Service hotspot: ${svc}`,
                    description: `${count} incidents in the past ${daysBack} days`,
                    severity: count >= 7 ? 'high' : count >= 5 ? 'medium' : 'low',
                    suggestion: 'Prioritize reliability work on this service. Consider architectural review and adding more observability.',
                    incidents: count,
                    services: [svc],
                })
            }
        }

        // Sort by severity then by incident count
        const severityOrder = { high: 0, medium: 1, low: 2 }
        patterns.sort((a, b) => {
            const sevDiff = severityOrder[a.severity] - severityOrder[b.severity]
            if (sevDiff !== 0) return sevDiff
            return b.incidents - a.incidents
        })

        return NextResponse.json({
            patterns,
            total_analyzed: investigations.length,
            days_analyzed: daysBack,
        })

    } catch (error) {
        console.error('Error detecting patterns:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

function getSuggestionForCause(cause: string): string {
    const suggestions: Record<string, string> = {
        connection_pool: 'Consider increasing connection pool size or adding a connection pooler like PgBouncer.',
        memory_leak: 'Add memory profiling to your deployment pipeline. Review recent code for proper resource cleanup.',
        timeout: 'Review timeout configurations across services. Consider implementing circuit breakers.',
        rate_limit: 'Implement request queuing or increase rate limits. Add proper caching for high-traffic endpoints.',
        database: 'Review query performance and indexing. Consider adding read replicas or query caching.',
        cache: 'Review cache invalidation logic and TTLs. Ensure cache is properly sized for workload.',
        deployment: 'Strengthen deployment validation. Add canary deployments or feature flags for safer rollouts.',
        configuration: 'Implement configuration validation and testing. Consider using feature flags for config changes.',
        cpu: 'Review CPU-intensive operations. Consider optimizing algorithms or adding horizontal scaling.',
        disk: 'Implement disk usage monitoring and alerts. Review log retention policies.',
        network: 'Review network configurations and timeouts. Consider adding retry logic with backoff.',
        authentication: 'Review token expiration and refresh logic. Ensure proper error handling for auth failures.',
        certificate: 'Set up certificate expiration monitoring. Automate certificate renewal where possible.',
        oom: 'Review memory limits and usage patterns. Consider adding memory-based autoscaling.',
    }

    return suggestions[cause] || 'Review the root causes and consider adding monitoring for early detection.'
}
