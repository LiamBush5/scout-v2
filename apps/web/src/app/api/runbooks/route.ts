import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for investigation steps
const investigationStepSchema = z.object({
    action: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().optional(),
})

// Schema for creating a runbook
const createRunbookSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    trigger_type: z.enum(['alert_pattern', 'service_alert', 'manual']),
    trigger_config: z.record(z.string(), z.unknown()).optional(),
    investigation_steps: z.array(investigationStepSchema).min(1),
    if_found_actions: z.record(z.string(), z.string()).optional(),
    enabled: z.boolean().optional(),
    priority: z.number().min(1).max(1000).optional(),
})

/**
 * GET /api/runbooks - List all runbooks for the user's org
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

        // Get runbooks with execution stats
        const { data: runbooks, error } = await supabase
            .from('runbooks')
            .select(`
                *,
                runbook_executions (
                    id,
                    status,
                    conclusion,
                    confidence_score,
                    matched_condition,
                    user_feedback,
                    started_at,
                    completed_at,
                    duration_ms
                )
            `)
            .eq('org_id', profile.current_org_id)
            .order('priority', { ascending: true })

        if (error) {
            console.error('Failed to fetch runbooks:', error)
            return NextResponse.json({ error: 'Failed to fetch runbooks' }, { status: 500 })
        }

        // Transform to include only the latest execution and calculate stats
        const runbooksWithStats = runbooks?.map(runbook => {
            const executions = runbook.runbook_executions || []
            const latestExecution = executions.sort((a: { started_at: string }, b: { started_at: string }) =>
                new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
            )[0]

            // Calculate success rate
            const completed = executions.filter((e: { status: string }) => e.status === 'completed')
            const helpful = executions.filter((e: { user_feedback: string }) => e.user_feedback === 'helpful')
            const successRate = completed.length > 0
                ? Math.round((helpful.length / completed.length) * 100)
                : null

            return {
                ...runbook,
                runbook_executions: undefined,
                latest_execution: latestExecution || null,
                success_rate: successRate,
                total_executions: executions.length,
            }
        })

        return NextResponse.json({ runbooks: runbooksWithStats })

    } catch (error) {
        console.error('Error fetching runbooks:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/runbooks - Create a new runbook
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
        const validatedData = createRunbookSchema.parse(body)

        const { data: runbook, error } = await supabase
            .from('runbooks')
            .insert({
                org_id: profile.current_org_id,
                name: validatedData.name,
                description: validatedData.description,
                trigger_type: validatedData.trigger_type,
                trigger_config: validatedData.trigger_config ?? {},
                investigation_steps: validatedData.investigation_steps,
                if_found_actions: validatedData.if_found_actions ?? {},
                enabled: validatedData.enabled ?? true,
                priority: validatedData.priority ?? 100,
                created_by: user.id,
            })
            .select()
            .single()

        if (error) {
            console.error('Failed to create runbook:', error)
            if (error.code === '23505') {
                return NextResponse.json({ error: 'A runbook with this name already exists' }, { status: 409 })
            }
            return NextResponse.json({ error: 'Failed to create runbook' }, { status: 500 })
        }

        return NextResponse.json({ runbook }, { status: 201 })

    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
        }
        console.error('Error creating runbook:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
