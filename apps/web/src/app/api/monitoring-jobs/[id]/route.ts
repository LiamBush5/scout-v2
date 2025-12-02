import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserOrg } from '@/lib/auth/helpers'
import { z } from 'zod'

const updateJobSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    schedule_interval: z.number().min(5).max(1440).optional(),
    enabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    slack_channel_id: z.string().nullable().optional(),
    notify_on: z.enum(['always', 'issues', 'never']).optional(),
})

/**
 * GET /api/monitoring-jobs/[id] - Get a specific monitoring job with run history
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()

        const auth = await getUserOrg(supabase)
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // Get job with recent runs - verify it belongs to user's org
        const { data: job, error } = await supabase
            .from('monitoring_jobs')
            .select(`
                *,
                monitoring_job_runs (
                    id,
                    status,
                    summary,
                    findings,
                    alert_sent,
                    alert_severity,
                    error_message,
                    started_at,
                    completed_at,
                    duration_ms
                )
            `)
            .eq('id', id)
            .eq('org_id', auth.orgId)
            .single()

        if (error || !job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // Sort runs by started_at descending and limit to 20
        const runs = (job.monitoring_job_runs || [])
            .sort((a: { started_at: string }, b: { started_at: string }) =>
                new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
            )
            .slice(0, 20)

        return NextResponse.json({
            job: {
                ...job,
                monitoring_job_runs: undefined,
                runs,
            }
        })

    } catch (error) {
        console.error('Error fetching monitoring job:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * PATCH /api/monitoring-jobs/[id] - Update a monitoring job
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()

        const auth = await getUserOrg(supabase)
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const validatedData = updateJobSchema.parse(body)

        // Verify job belongs to user's org before updating
        const { data: existingJob, error: checkError } = await supabase
            .from('monitoring_jobs')
            .select('id, schedule_interval')
            .eq('id', id)
            .eq('org_id', auth.orgId)
            .single()

        if (checkError || !existingJob) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        // Build update object
        const updateData: Record<string, unknown> = {
            ...validatedData,
            updated_at: new Date().toISOString(),
        }

        // If enabling, set next_run_at
        if (validatedData.enabled === true) {
            const interval = validatedData.schedule_interval || existingJob.schedule_interval
            const nextRunAt = new Date()
            nextRunAt.setMinutes(nextRunAt.getMinutes() + interval)
            updateData.next_run_at = nextRunAt.toISOString()
        } else if (validatedData.enabled === false) {
            updateData.next_run_at = null
        }

        const { data: job, error } = await supabase
            .from('monitoring_jobs')
            .update(updateData)
            .eq('id', id)
            .eq('org_id', auth.orgId)
            .select()
            .single()

        if (error) {
            console.error('Failed to update monitoring job:', error)
            return NextResponse.json({ error: 'Failed to update job' }, { status: 500 })
        }

        return NextResponse.json({ job })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
        }
        console.error('Error updating monitoring job:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/monitoring-jobs/[id] - Delete a monitoring job
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()

        const auth = await getUserOrg(supabase)
        if ('error' in auth) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // Delete with org_id check to ensure user can only delete their org's jobs
        const { error, count } = await supabase
            .from('monitoring_jobs')
            .delete()
            .eq('id', id)
            .eq('org_id', auth.orgId)

        if (error) {
            console.error('Failed to delete monitoring job:', error)
            return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
        }

        // If no rows deleted, job didn't exist or didn't belong to user's org
        if (count === 0) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error deleting monitoring job:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
