import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { MonitoringJob } from '@/lib/monitoring'

// Vercel Cron configuration
export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute - cron should dispatch quickly

/**
 * Cron endpoint - runs every 5 minutes, dispatches pending jobs
 *
 * Uses a "fan-out" pattern for scalability:
 * 1. Get all pending jobs (jobs where next_run_at <= now)
 * 2. Update next_run_at immediately to prevent double-dispatch
 * 3. Dispatch each job to /api/monitoring-jobs/[id]/run (fire-and-forget)
 * 4. Each job runs independently in its own request
 *
 * This scales to 1000s of jobs because we don't wait for execution.
 */
export async function GET(request: NextRequest) {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const startTime = Date.now()
    const supabaseAdmin = getSupabaseAdmin()

    try {
        // Get pending jobs
        const { data: pendingJobs, error: jobsError } = await supabaseAdmin.rpc(
            'get_pending_monitoring_jobs'
        )

        if (jobsError) {
            console.error('[Cron] Failed to get pending jobs:', jobsError)
            return NextResponse.json({ error: 'Failed to get pending jobs' }, { status: 500 })
        }

        if (!pendingJobs || pendingJobs.length === 0) {
            return NextResponse.json({
                message: 'No pending jobs',
                duration_ms: Date.now() - startTime,
            })
        }

        // Limit jobs per cron invocation to prevent overload
        const MAX_JOBS_PER_CRON = 50
        const jobsToRun = (pendingJobs as MonitoringJob[]).slice(0, MAX_JOBS_PER_CRON)

        console.log(
            `[Cron] Found ${pendingJobs.length} pending jobs, dispatching ${jobsToRun.length}`
        )

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const results: Array<{ job_id: string; job_name: string; dispatched: boolean; error?: string }> = []

        // Dispatch jobs in parallel
        await Promise.all(
            jobsToRun.map(async (job) => {
                try {
                    // Update next_run_at immediately to prevent double-dispatch
                    await supabaseAdmin
                        .from('monitoring_jobs')
                        .update({
                            next_run_at: new Date(
                                Date.now() + job.schedule_interval * 60 * 1000
                            ).toISOString(),
                        })
                        .eq('id', job.id)

                    // Fire-and-forget: trigger the job endpoint
                    fetch(`${baseUrl}/api/monitoring-jobs/${job.id}/run`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-cron-secret': process.env.CRON_SECRET || '',
                        },
                    }).catch((err) => {
                        console.error(`[Cron] Failed to dispatch job ${job.id}:`, err)
                    })

                    results.push({ job_id: job.id, job_name: job.name, dispatched: true })
                } catch (error) {
                    console.error(`[Cron] Failed to dispatch job ${job.id}:`, error)
                    results.push({
                        job_id: job.id,
                        job_name: job.name,
                        dispatched: false,
                        error: String(error),
                    })
                }
            })
        )

        const dispatchedCount = results.filter((r) => r.dispatched).length

        return NextResponse.json({
            message: `Dispatched ${dispatchedCount} jobs`,
            total_pending: pendingJobs.length,
            dispatched: dispatchedCount,
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

// Support POST for manual triggering
export async function POST(request: NextRequest) {
    return GET(request)
}
