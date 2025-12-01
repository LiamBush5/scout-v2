import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/insights - Get service health insights
 *
 * Query params:
 *   - days_back: number of days to analyze (default: 30)
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const daysBack = parseInt(searchParams.get('days_back') || '30')

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

        // Fetch all insights in parallel
        const [serviceHealth, alertEffectiveness, rootCausePatterns, recentStats] = await Promise.all([
            // Service health summary
            supabase.rpc('get_service_health_summary', {
                p_org_id: profile.current_org_id,
                p_days_back: daysBack,
            }),

            // Alert effectiveness
            supabase.rpc('get_alert_effectiveness', {
                p_org_id: profile.current_org_id,
                p_days_back: daysBack,
            }),

            // Root cause patterns
            supabase.rpc('get_root_cause_patterns', {
                p_org_id: profile.current_org_id,
                p_days_back: daysBack,
            }),

            // Recent investigation stats
            supabase
                .from('investigations')
                .select('id, status, confidence_score, feedback_rating, duration_ms, created_at')
                .eq('org_id', profile.current_org_id)
                .gte('created_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false }),
        ])

        // Calculate summary stats from recent investigations
        const investigations = recentStats.data || []
        const completed = investigations.filter((i: { status: string }) => i.status === 'completed')
        const withFeedback = completed.filter((i: { feedback_rating: string | null }) => i.feedback_rating !== null)
        const helpful = withFeedback.filter((i: { feedback_rating: string }) => i.feedback_rating === 'helpful')

        const summary = {
            total_investigations: investigations.length,
            completed: completed.length,
            completion_rate: investigations.length > 0
                ? Math.round((completed.length / investigations.length) * 100)
                : 0,
            helpful_rate: withFeedback.length > 0
                ? Math.round((helpful.length / withFeedback.length) * 100)
                : null,
            avg_confidence: completed.length > 0
                ? Math.round(completed.reduce((sum: number, i: { confidence_score: number | null }) =>
                    sum + (i.confidence_score || 0), 0) / completed.length * 100)
                : null,
            avg_resolution_time_ms: completed.length > 0
                ? Math.round(completed.reduce((sum: number, i: { duration_ms: number | null }) =>
                    sum + (i.duration_ms || 0), 0) / completed.length)
                : null,
            days_analyzed: daysBack,
        }

        return NextResponse.json({
            summary,
            service_health: serviceHealth.data || [],
            alert_effectiveness: alertEffectiveness.data || [],
            root_cause_patterns: rootCausePatterns.data || [],
        })

    } catch (error) {
        console.error('Error fetching insights:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
