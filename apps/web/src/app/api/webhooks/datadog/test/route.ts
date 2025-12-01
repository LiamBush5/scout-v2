import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Test endpoint for Datadog webhook integration
 * Creates a test investigation to verify the webhook pipeline is working
 */
export async function POST() {
    try {
        const supabase = await createClient()

        // Get current user and org
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('current_org_id')
            .eq('id', user.id)
            .single()

        if (!profile?.current_org_id) {
            return NextResponse.json({ error: 'No organization found' }, { status: 400 })
        }

        // Create a test investigation
        const { data: investigation, error: investigationError } = await supabase
            .from('investigations')
            .insert({
                org_id: profile.current_org_id,
                trigger_type: 'datadog_webhook',
                trigger_payload: {
                    alert_id: 'test-' + Date.now(),
                    alert_title: '[Scout] Test Alert',
                    alert_status: 'Triggered',
                    message: 'This is a test alert from Scout to verify webhook integration.',
                    tags: ['test', 'scout'],
                    link: '',
                },
                monitor_id: 'test-' + Date.now(),
                monitor_name: '[Scout] Test Alert',
                alert_name: '[Scout] Test Alert',
                service: null,
                severity: 'low',
                status: 'completed',
                summary: 'This is a test investigation created to verify your Datadog webhook integration is configured correctly.',
            })
            .select()
            .single()

        if (investigationError || !investigation) {
            console.error('Failed to create test investigation:', investigationError)
            return NextResponse.json(
                { error: 'Failed to create test investigation' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            investigation_id: investigation.id,
            message: 'Test investigation created successfully',
        })
    } catch (error) {
        console.error('Test webhook error:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
