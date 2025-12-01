import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createJobSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    job_type: z.enum(['deployment_watcher', 'health_check', 'error_scanner', 'baseline_builder', 'custom']),
    schedule_interval: z.number().min(5).max(1440), // 5 min to 24 hours
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    slack_channel_id: z.string().optional(),
    notify_on: z.enum(['always', 'issues', 'never']).optional(),
})

/**
 * GET /api/monitoring-jobs - List all monitoring jobs for the user's org
 */
export async function GET() {
    try {
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
            return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
        }

        // Get jobs with latest run info
        const { data: jobs, error } = await supabase
            .from('monitoring_jobs')
            .select(`
                *,
                monitoring_job_runs (
                    id,
                    status,
                    summary,
                    findings,
                    error_message,
                    alert_sent,
                    alert_severity,
                    started_at,
                    completed_at,
                    duration_ms
                )
            `)
            .eq('org_id', profile.current_org_id)
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Failed to fetch monitoring jobs:', error)
            return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
        }

        // Transform to include only the latest run
        const jobsWithLatestRun = jobs?.map(job => {
            const runs = job.monitoring_job_runs || []
            const latestRun = runs.sort((a: { started_at: string }, b: { started_at: string }) =>
                new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
            )[0]

            return {
                ...job,
                monitoring_job_runs: undefined,
                latest_run: latestRun || null,
            }
        })

        return NextResponse.json({ jobs: jobsWithLatestRun })

    } catch (error) {
        console.error('Error fetching monitoring jobs:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/monitoring-jobs - Create a new monitoring job
 */
export async function POST(request: NextRequest) {
    try {
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
            return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
        }

        const body = await request.json()
        const validatedData = createJobSchema.parse(body)

        // Calculate next run time
        const nextRunAt = new Date()
        nextRunAt.setMinutes(nextRunAt.getMinutes() + validatedData.schedule_interval)

        const { data: job, error } = await supabase
            .from('monitoring_jobs')
            .insert({
                org_id: profile.current_org_id,
                name: validatedData.name,
                description: validatedData.description,
                job_type: validatedData.job_type,
                schedule_interval: validatedData.schedule_interval,
                enabled: validatedData.enabled,
                config: validatedData.config,
                slack_channel_id: validatedData.slack_channel_id,
                notify_on: validatedData.notify_on,
                next_run_at: validatedData.enabled ? nextRunAt.toISOString() : null,
                created_by: user.id,
            })
            .select()
            .single()

        if (error) {
            console.error('Failed to create monitoring job:', error)
            return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
        }

        return NextResponse.json({ job }, { status: 201 })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
        }
        console.error('Error creating monitoring job:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
