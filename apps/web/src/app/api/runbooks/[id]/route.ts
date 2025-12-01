import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const investigationStepSchema = z.object({
    action: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().optional(),
})

const updateRunbookSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    trigger_type: z.enum(['alert_pattern', 'service_alert', 'manual']).optional(),
    trigger_config: z.record(z.string(), z.unknown()).optional(),
    investigation_steps: z.array(investigationStepSchema).min(1).optional(),
    if_found_actions: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().optional(),
    priority: z.number().min(1).max(1000).optional(),
})

/**
 * GET /api/runbooks/[id] - Get a specific runbook with execution history
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get runbook with recent executions
        const { data: runbook, error } = await supabase
            .from('runbooks')
            .select(`
                *,
                runbook_executions (
                    id,
                    status,
                    trigger_source,
                    trigger_data,
                    steps_executed,
                    findings,
                    conclusion,
                    confidence_score,
                    matched_condition,
                    user_feedback,
                    started_at,
                    completed_at,
                    duration_ms
                )
            `)
            .eq('id', id)
            .single()

        if (error || !runbook) {
            return NextResponse.json({ error: 'Runbook not found' }, { status: 404 })
        }

        // Sort executions by started_at descending and limit to 20
        const executions = (runbook.runbook_executions || [])
            .sort((a: { started_at: string }, b: { started_at: string }) =>
                new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
            )
            .slice(0, 20)

        return NextResponse.json({
            runbook: {
                ...runbook,
                runbook_executions: undefined,
                executions,
            }
        })

    } catch (error) {
        console.error('Error fetching runbook:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * PATCH /api/runbooks/[id] - Update a runbook
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const validatedData = updateRunbookSchema.parse(body)

        const updateData: Record<string, unknown> = {
            ...validatedData,
            updated_at: new Date().toISOString(),
        }

        const { data: runbook, error } = await supabase
            .from('runbooks')
            .update(updateData)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            console.error('Failed to update runbook:', error)
            if (error.code === '23505') {
                return NextResponse.json({ error: 'A runbook with this name already exists' }, { status: 409 })
            }
            return NextResponse.json({ error: 'Failed to update runbook' }, { status: 500 })
        }

        return NextResponse.json({ runbook })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
        }
        console.error('Error updating runbook:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/runbooks/[id] - Delete a runbook
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { error } = await supabase
            .from('runbooks')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Failed to delete runbook:', error)
            return NextResponse.json({ error: 'Failed to delete runbook' }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('Error deleting runbook:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
