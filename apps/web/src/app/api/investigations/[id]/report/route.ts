import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
    params: Promise<{ id: string }>
}

/**
 * GET /api/investigations/[id]/report - Generate a post-incident report
 *
 * This generates a structured, shareable report from the investigation data.
 * The LLM has already done the analysis - this just formats it nicely.
 */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { id } = await context.params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get user's org
        const { data: profile } = await supabase
            .from('profiles')
            .select('current_org_id')
            .eq('id', user.id)
            .single()

        if (!profile?.current_org_id) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 })
        }

        // Get the investigation with all details
        const { data: investigation, error } = await supabase
            .from('investigations')
            .select('*')
            .eq('id', id)
            .eq('org_id', profile.current_org_id)
            .single()

        if (error || !investigation) {
            return NextResponse.json({ error: 'Investigation not found' }, { status: 404 })
        }

        if (investigation.status !== 'completed') {
            return NextResponse.json({ error: 'Investigation not yet completed' }, { status: 400 })
        }

        // Search for similar past incidents
        const { data: similarIncidents } = await supabase
            .from('investigations')
            .select('id, alert_name, root_cause, created_at, confidence_score')
            .eq('org_id', profile.current_org_id)
            .eq('service', investigation.service)
            .eq('status', 'completed')
            .neq('id', investigation.id)
            .order('created_at', { ascending: false })
            .limit(3)

        // Build the report
        const report = generateReport(investigation, similarIncidents || [])

        return NextResponse.json({ report })

    } catch (error) {
        console.error('Error generating report:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

interface Investigation {
    id: string
    alert_name: string | null
    service: string | null
    environment: string | null
    severity: string | null
    monitor_name: string | null
    trigger_type: string
    status: string
    created_at: string
    started_at: string | null
    completed_at: string | null
    duration_ms: number | null
    summary: string | null
    root_cause: string | null
    confidence_score: number | null
    findings: unknown[] | null
    suggested_actions: unknown[] | null
    deployments_found: unknown[] | null
    tool_calls: number | null
    feedback_rating: string | null
    feedback_comment: string | null
}

interface SimilarIncident {
    id: string
    alert_name: string | null
    root_cause: string | null
    created_at: string
    confidence_score: number | null
}

function generateReport(investigation: Investigation, similarIncidents: SimilarIncident[]) {
    const createdAt = new Date(investigation.created_at)
    const completedAt = investigation.completed_at ? new Date(investigation.completed_at) : null

    // Format duration
    const durationMs = investigation.duration_ms || 0
    const durationStr = durationMs < 60000
        ? `${(durationMs / 1000).toFixed(1)}s`
        : `${(durationMs / 60000).toFixed(1)}m`

    // Format confidence
    const confidence = investigation.confidence_score
        ? `${Math.round(investigation.confidence_score * 100)}%`
        : 'Unknown'

    const confidenceLevel = investigation.confidence_score
        ? investigation.confidence_score >= 0.8 ? 'HIGH'
            : investigation.confidence_score >= 0.5 ? 'MEDIUM' : 'LOW'
        : 'UNKNOWN'

    // Build timeline
    const timeline = [
        {
            time: createdAt.toISOString(),
            event: `Alert triggered: ${investigation.alert_name || 'Unknown alert'}`,
        },
    ]

    if (investigation.started_at) {
        timeline.push({
            time: investigation.started_at,
            event: 'Investigation started',
        })
    }

    if (completedAt) {
        timeline.push({
            time: completedAt.toISOString(),
            event: `Investigation completed (${durationStr})`,
        })
    }

    // Format findings
    const findings = Array.isArray(investigation.findings)
        ? investigation.findings.map(f => typeof f === 'string' ? f : JSON.stringify(f))
        : []

    // Format actions
    const actions = Array.isArray(investigation.suggested_actions)
        ? investigation.suggested_actions.map(a => typeof a === 'string' ? a : JSON.stringify(a))
        : []

    // Format deployments
    type DeploymentInfo = { sha: string; author: string; message: string; deployed_at: unknown }
    const deployments: DeploymentInfo[] = Array.isArray(investigation.deployments_found)
        ? investigation.deployments_found
            .map((d: unknown): DeploymentInfo | null => {
                if (typeof d === 'object' && d !== null) {
                    const deploy = d as Record<string, unknown>
                    return {
                        sha: String(deploy.sha || '').slice(0, 8),
                        author: String(deploy.author || 'Unknown'),
                        message: String(deploy.message || '').slice(0, 100),
                        deployed_at: deploy.deployed_at || deploy.created_at || null,
                    }
                }
                return null
            })
            .filter((d): d is DeploymentInfo => d !== null)
        : []

    // Format similar incidents
    const similar = similarIncidents.map(inc => ({
        id: inc.id.slice(0, 8),
        alert_name: inc.alert_name,
        root_cause: inc.root_cause?.slice(0, 100) || 'Unknown',
        days_ago: Math.floor((Date.now() - new Date(inc.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))

    return {
        // Header info
        id: investigation.id,
        title: investigation.alert_name || 'Untitled Investigation',
        service: investigation.service || 'Unknown service',
        environment: investigation.environment || 'prod',
        severity: investigation.severity || 'unknown',

        // Timing
        triggered_at: createdAt.toISOString(),
        completed_at: completedAt?.toISOString() || null,
        duration: durationStr,
        duration_ms: durationMs,

        // Root cause
        root_cause: investigation.root_cause || 'Not identified',
        confidence: confidence,
        confidence_level: confidenceLevel,
        confidence_score: investigation.confidence_score,

        // Summary
        summary: investigation.summary || 'No summary available',

        // Details
        findings: findings,
        suggested_actions: actions,
        deployments_found: deployments,

        // Timeline
        timeline: timeline,

        // Similar incidents
        similar_incidents: similar,

        // Meta
        trigger_type: investigation.trigger_type,
        tool_calls: investigation.tool_calls || 0,
        feedback: investigation.feedback_rating
            ? {
                rating: investigation.feedback_rating,
                comment: investigation.feedback_comment || null,
            }
            : null,

        // Markdown version for sharing
        markdown: generateMarkdown({
            title: investigation.alert_name || 'Untitled Investigation',
            service: investigation.service || 'Unknown service',
            severity: investigation.severity || 'unknown',
            triggered_at: createdAt,
            duration: durationStr,
            root_cause: investigation.root_cause || 'Not identified',
            confidence: confidence,
            confidence_level: confidenceLevel,
            summary: investigation.summary || 'No summary available',
            findings: findings,
            actions: actions,
            deployments: deployments,
            similar: similar,
        }),
    }
}

function generateMarkdown(data: {
    title: string
    service: string
    severity: string
    triggered_at: Date
    duration: string
    root_cause: string
    confidence: string
    confidence_level: string
    summary: string
    findings: string[]
    actions: string[]
    deployments: { sha: string; author: string; message: string; deployed_at: unknown }[]
    similar: { id: string; alert_name: string | null; root_cause: string; days_ago: number }[]
}): string {
    const lines: string[] = []

    lines.push(`# Post-Incident Report: ${data.title}`)
    lines.push('')
    lines.push(`**Service:** ${data.service}`)
    lines.push(`**Severity:** ${data.severity.toUpperCase()}`)
    lines.push(`**Triggered:** ${data.triggered_at.toLocaleString()}`)
    lines.push(`**Investigation Duration:** ${data.duration}`)
    lines.push('')

    lines.push('## Root Cause')
    lines.push('')
    lines.push(`> **${data.confidence_level} CONFIDENCE (${data.confidence})**`)
    lines.push('')
    lines.push(data.root_cause)
    lines.push('')

    lines.push('## Summary')
    lines.push('')
    lines.push(data.summary)
    lines.push('')

    if (data.findings.length > 0) {
        lines.push('## Key Findings')
        lines.push('')
        data.findings.forEach(f => lines.push(`- ${f}`))
        lines.push('')
    }

    if (data.deployments.length > 0) {
        lines.push('## Related Deployments')
        lines.push('')
        data.deployments.forEach(d => {
            lines.push(`- \`${d.sha}\` by ${d.author}: ${d.message}`)
        })
        lines.push('')
    }

    if (data.actions.length > 0) {
        lines.push('## Action Items')
        lines.push('')
        data.actions.forEach((a, i) => lines.push(`${i + 1}. ${a}`))
        lines.push('')
    }

    if (data.similar.length > 0) {
        lines.push('## Similar Past Incidents')
        lines.push('')
        data.similar.forEach(s => {
            lines.push(`- **${s.alert_name || 'Unknown'}** (${s.days_ago} days ago): ${s.root_cause}`)
        })
        lines.push('')
    }

    lines.push('---')
    lines.push('*Generated by Scout AI*')

    return lines.join('\n')
}
