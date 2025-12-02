import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { loadCredentials, executeJob } from '@/lib/monitoring'
import type { MonitoringJob } from '@/lib/monitoring'

/**
 * POST /api/monitoring-jobs/[id]/run - Manually trigger a monitoring job
 *
 * Authorization: User must be authenticated and job must belong to their org.
 * Can also be called by cron with x-cron-secret header.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const cronSecret = request.headers.get('x-cron-secret')
        const isCronRequest = cronSecret === process.env.CRON_SECRET

        const supabase = await createClient()
        const supabaseAdmin = getSupabaseAdmin()

        // For non-cron requests, verify user authentication
        if (!isCronRequest) {
            const auth = await getUserOrg(supabase)
            if ('error' in auth) {
                return NextResponse.json({ error: auth.error }, { status: auth.status })
            }

            // Check job exists and belongs to user's org
            const { data: job, error: jobError } = await supabase
                .from('monitoring_jobs')
                .select('*')
                .eq('id', id)
                .eq('org_id', auth.orgId)
                .single()

            if (jobError || !job) {
                return NextResponse.json({ error: 'Job not found' }, { status: 404 })
            }

            return await startJobRun(job as MonitoringJob, supabaseAdmin)
        }

        // Cron request - get job directly
        const { data: job, error: jobError } = await supabaseAdmin
            .from('monitoring_jobs')
            .select('*')
            .eq('id', id)
            .single()

        if (jobError || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return await startJobRun(job as MonitoringJob, supabaseAdmin)
    } catch (error) {
        console.error('Error triggering monitoring job:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

async function startJobRun(
    job: MonitoringJob,
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
) {
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

    // Load credentials and execute in background
    const credentials = await loadCredentials(job.org_id, supabaseAdmin)

    // Fire and forget - don't await
    executeJob(job, credentials, run.id, supabaseAdmin).catch((error) => {
        console.error('Job execution failed:', error)
    })

    return NextResponse.json({
        message: 'Job started',
        run_id: run.id,
    })
}
