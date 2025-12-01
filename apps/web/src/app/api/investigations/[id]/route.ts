import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ id: string }>
}

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

    const orgId = profile.current_org_id

    // Fetch investigation
    const { data: investigation, error } = await supabase
      .from('investigations')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single()

    if (error || !investigation) {
      return NextResponse.json({ error: 'Investigation not found' }, { status: 404 })
    }

    // Fetch investigation events
    const { data: events } = await supabase
      .from('investigation_events')
      .select('*')
      .eq('investigation_id', id)
      .order('created_at', { ascending: true })

    return NextResponse.json({
      investigation,
      events: events || [],
    })
  } catch (error) {
    console.error('Investigation API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update investigation feedback
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const orgId = profile.current_org_id

    const body = await request.json()
    const { feedback_rating, feedback_comment } = body

    // Validate feedback_rating
    if (feedback_rating && !['helpful', 'not_helpful'].includes(feedback_rating)) {
      return NextResponse.json({ error: 'Invalid feedback rating' }, { status: 400 })
    }

    // Update investigation
    const { data: investigation, error } = await supabase
      .from('investigations')
      .update({
        feedback_rating,
        feedback_comment,
        feedback_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (error) {
      console.error('Failed to update investigation:', error)
      return NextResponse.json({ error: 'Failed to update investigation' }, { status: 500 })
    }

    if (!investigation) {
      return NextResponse.json({ error: 'Investigation not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, investigation })
  } catch (error) {
    console.error('Investigation PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
