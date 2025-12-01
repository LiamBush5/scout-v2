import { StatsCards } from '@/components/dashboard/stats-cards'
import { InvestigationCard } from '@/components/dashboard/investigation-card'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Zap } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

async function getInvestigations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { investigations: [], stats: null }

  // Get user's current org
  const { data: profile } = await supabase
    .from('profiles')
    .select('current_org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_org_id) return { investigations: [], stats: null }

  // Fetch recent investigations
  const { data: investigations } = await supabase
    .from('investigations')
    .select('*')
    .eq('org_id', profile.current_org_id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Calculate stats
  const { data: allInvestigations } = await supabase
    .from('investigations')
    .select('id, status, duration_ms, confidence_score, feedback_rating')
    .eq('org_id', profile.current_org_id)

  const total = allInvestigations?.length || 0
  const completed = allInvestigations?.filter(i => i.status === 'completed') || []
  const avgDuration = completed.length > 0
    ? Math.round(completed.reduce((sum, i) => sum + (i.duration_ms || 0), 0) / completed.length / 1000)
    : 0
  const helpful = allInvestigations?.filter(i => i.feedback_rating === 'helpful').length || 0
  const rated = allInvestigations?.filter(i => i.feedback_rating).length || 0
  const accuracy = rated > 0 ? Math.round((helpful / rated) * 100) : 0
  const running = allInvestigations?.filter(i => i.status === 'running' || i.status === 'queued').length || 0

  const stats = {
    totalInvestigations: total,
    avgResponseTime: avgDuration > 0 ? `${avgDuration}s` : 'N/A',
    accuracy: rated > 0 ? `${accuracy}%` : 'N/A',
    activeAlerts: running,
  }

  return {
    investigations: (investigations || []).map(inv => ({
      id: inv.id,
      title: inv.alert_name || inv.monitor_name || 'Investigation',
      service: inv.service || 'Unknown',
      status: inv.status as 'completed' | 'running' | 'failed' | 'queued',
      confidence: inv.confidence_score || undefined,
      summary: inv.summary || undefined,
      createdAt: inv.created_at,
      durationMs: inv.duration_ms || undefined,
      feedback: inv.feedback_rating as 'helpful' | 'not_helpful' | null,
    })),
    stats,
  }
}

export default async function DashboardPage() {
  const { investigations, stats } = await getInvestigations()
  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Overview</h1>
        <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
          <Link href="/dashboard/investigations">
            View All
            <ArrowRight className="ml-1.5 h-3 w-3" />
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <StatsCards stats={stats || { totalInvestigations: 0, avgResponseTime: 'N/A', accuracy: 'N/A', activeAlerts: 0 }} />

      {/* Quick actions */}
      <Card className="p-5 border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Ready to investigate</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                The agent will automatically investigate any alert sent to your webhook
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/integrations">
              Manage
            </Link>
          </Button>
        </div>
      </Card>

      {/* Recent investigations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Recent Investigations</h2>
          <Link
            href="/dashboard/investigations"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
          </Link>
        </div>
        <div className="space-y-2">
          {investigations.length > 0 ? (
            investigations.map((investigation) => (
              <InvestigationCard
                key={investigation.id}
                investigation={investigation}
              />
            ))
          ) : (
            <Card className="p-8 text-center border-border/50">
              <p className="text-muted-foreground text-sm">No investigations yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Investigations will appear here when alerts are received via the Datadog webhook.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
