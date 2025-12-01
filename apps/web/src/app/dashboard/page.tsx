'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ArrowRight,
  Zap,
  Activity,
  Clock,
  Target,
  TrendingUp,
  TrendingDown,
  Server,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  Settings,
  BarChart3,
  History,
  Search,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { DatadogIcon, SlackIcon, GitHubIcon, integrationConfig } from '@/components/icons/integrations'

interface Investigation {
  id: string
  alertName: string
  service: string
  severity: string | null
  status: string
  confidence: number | null
  rootCause: string | null
  createdAt: string
  durationMs: number | null
  feedback: string | null
}

interface Integration {
  provider: string
  status: string
}

export default function DashboardPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('current_org_id')
        .eq('id', user.id)
        .single()

      if (!profile?.current_org_id) {
        setLoading(false)
        return
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: invData } = await supabase
        .from('investigations')
        .select('*')
        .eq('org_id', profile.current_org_id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (invData) {
        setInvestigations(invData.map(inv => ({
          id: inv.id,
          alertName: inv.alert_name || inv.monitor_name || 'Investigation',
          service: inv.service || 'Unknown',
          severity: inv.severity,
          status: inv.status,
          confidence: inv.confidence_score,
          rootCause: inv.root_cause,
          createdAt: inv.created_at,
          durationMs: inv.duration_ms,
          feedback: inv.feedback_rating,
        })))
      }

      const { data: intData } = await supabase
        .from('integrations')
        .select('provider, status')
        .eq('org_id', profile.current_org_id)

      if (intData) {
        setIntegrations(intData)
      }

      setLoading(false)
    }

    fetchData()
  }, [])

  const stats = useMemo(() => {
    const completed = investigations.filter(inv => inv.status === 'completed')
    const running = investigations.filter(inv => inv.status === 'running' || inv.status === 'queued')
    const withFeedback = completed.filter(inv => inv.feedback)
    const helpful = withFeedback.filter(inv => inv.feedback === 'helpful')

    const avgDuration = completed.length > 0
      ? completed.reduce((sum, inv) => sum + (inv.durationMs || 0), 0) / completed.length
      : 0

    const avgConfidence = completed.length > 0
      ? completed.reduce((sum, inv) => sum + (inv.confidence || 0), 0) / completed.length
      : 0

    const bySeverity = {
      critical: investigations.filter(inv => inv.severity === 'critical').length,
      high: investigations.filter(inv => inv.severity === 'high').length,
      medium: investigations.filter(inv => inv.severity === 'medium').length,
      low: investigations.filter(inv => inv.severity === 'low').length,
    }

    const serviceMap = new Map<string, number>()
    investigations.forEach(inv => {
      serviceMap.set(inv.service, (serviceMap.get(inv.service) || 0) + 1)
    })
    const byService = Array.from(serviceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    const dailyTrend: { date: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayInvs = investigations.filter(inv => inv.createdAt.startsWith(dateStr))
      dailyTrend.push({ date: dateStr, count: dayInvs.length })
    }

    const rootCauseMap = new Map<string, number>()
    completed.forEach(inv => {
      if (inv.rootCause) {
        const rc = inv.rootCause.toLowerCase()
        let category = 'Other'
        if (rc.includes('deploy') || rc.includes('commit') || rc.includes('release')) category = 'Deployment'
        else if (rc.includes('database') || rc.includes('db') || rc.includes('query')) category = 'Database'
        else if (rc.includes('timeout') || rc.includes('latency') || rc.includes('slow')) category = 'Performance'
        else if (rc.includes('memory') || rc.includes('cpu') || rc.includes('resource')) category = 'Resources'
        else if (rc.includes('config') || rc.includes('setting')) category = 'Configuration'
        else if (rc.includes('network') || rc.includes('connection')) category = 'Network'
        rootCauseMap.set(category, (rootCauseMap.get(category) || 0) + 1)
      }
    })
    const rootCauseCategories = Array.from(rootCauseMap.entries()).sort((a, b) => b[1] - a[1])

    const thisWeek = investigations.filter(inv => {
      const d = new Date(inv.createdAt)
      const now = new Date()
      return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
    }).length

    const lastWeek = investigations.filter(inv => {
      const d = new Date(inv.createdAt)
      const now = new Date()
      const diff = now.getTime() - d.getTime()
      return diff >= 7 * 24 * 60 * 60 * 1000 && diff < 14 * 24 * 60 * 60 * 1000
    }).length

    const weekChange = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek * 100) : 0

    return {
      total: investigations.length,
      completed: completed.length,
      running: running.length,
      avgDuration,
      avgConfidence,
      helpfulRate: withFeedback.length > 0 ? (helpful.length / withFeedback.length * 100) : 0,
      bySeverity,
      byService,
      dailyTrend,
      rootCauseCategories,
      weekChange,
      thisWeek,
    }
  }, [investigations])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(0)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const formatTimeAgo = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return `${Math.floor(diffMins / 1440)}d ago`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-3.5 w-3.5 text-primary" />
      case 'running': return <Activity className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
      case 'failed': return <XCircle className="h-3.5 w-3.5 text-destructive" />
      default: return <Clock className="h-3.5 w-3.5 text-yellow-400" />
    }
  }

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case 'critical': return 'text-red-400'
      case 'high': return 'text-orange-400'
      case 'medium': return 'text-yellow-400'
      case 'low': return 'text-blue-400'
      default: return 'text-muted-foreground'
    }
  }

  const integrationStatus = (provider: string) => {
    const int = integrations.find(i => i.provider === provider)
    return int?.status === 'connected'
  }

  const maxDailyCount = Math.max(...stats.dailyTrend.map(d => d.count), 1)

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/chat">
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
              Ask Scout
            </Link>
          </Button>
          <Button size="sm" className="h-8 text-xs" asChild>
            <Link href="/dashboard/investigations">
              <Search className="h-3.5 w-3.5 mr-1.5" />
              View All
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">This Week</div>
          <div className="text-3xl font-bold">{stats.thisWeek}</div>
          <div className="text-xs text-muted-foreground mt-1">investigations</div>
          {stats.weekChange !== 0 && (
            <div className="flex items-center gap-1 mt-2">
              {stats.weekChange > 0 ? (
                <TrendingUp className="h-3 w-3 text-yellow-400" />
              ) : (
                <TrendingDown className="h-3 w-3 text-primary" />
              )}
              <span className={cn("text-xs", stats.weekChange > 0 ? "text-yellow-400" : "text-primary")}>
                {Math.abs(stats.weekChange).toFixed(0)}% vs last week
              </span>
            </div>
          )}
        </Card>

        <Card className="p-5 border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Avg Resolution</div>
          <div className="text-3xl font-bold">{formatDuration(stats.avgDuration)}</div>
          <div className="text-xs text-muted-foreground mt-1">time to find root cause</div>
        </Card>

        <Card className="p-5 border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Helpful Rate</div>
          <div className="text-3xl font-bold">{stats.helpfulRate.toFixed(0)}%</div>
          <div className="text-xs text-muted-foreground mt-1">based on feedback</div>
        </Card>

        <Card className="p-5 border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-2">Active Now</div>
          <div className="text-3xl font-bold">{stats.running}</div>
          <div className="text-xs text-muted-foreground mt-1">investigations running</div>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Trend Chart */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Investigation Trend</h2>
              </div>
              <span className="text-xs text-muted-foreground">Last 7 days</span>
            </div>
            <div className="h-32 flex items-end gap-2">
              {stats.dailyTrend.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-xs font-medium">{day.count}</span>
                  <div
                    className={cn("w-full rounded-t-md", day.count > 0 ? "bg-primary" : "bg-muted")}
                    style={{ height: `${Math.max((day.count / maxDailyCount) * 80, 4)}px` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Root Cause */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Root Cause Categories</h2>
            </div>
            {stats.rootCauseCategories.length > 0 ? (
              <div className="space-y-3">
                {stats.rootCauseCategories.map(([category, count], i) => {
                  const percentage = (count / stats.completed) * 100
                  const colors = ['bg-primary', 'bg-blue-500', 'bg-orange-500', 'bg-green-500', 'bg-purple-500']
                  return (
                    <div key={category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{category}</span>
                        <span className="text-xs text-muted-foreground">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", colors[i % colors.length])} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No root cause data yet</p>
            )}
          </Card>

          {/* Recent Investigations */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Recent Investigations</h2>
              </div>
              <Link href="/dashboard/investigations" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {investigations.length > 0 ? (
              <div className="space-y-2">
                {investigations.slice(0, 5).map(inv => (
                  <Link
                    key={inv.id}
                    href={`/dashboard/investigations/${inv.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/30 hover:border-primary/30 transition-all group"
                  >
                    {getStatusIcon(inv.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{inv.alertName}</span>
                        {inv.severity && <span className={cn("text-[10px]", getSeverityColor(inv.severity))}>{inv.severity}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">{inv.service} · {formatTimeAgo(inv.createdAt)}</div>
                    </div>
                    {inv.confidence && (
                      <span className={cn("text-sm font-medium", inv.confidence >= 0.8 ? "text-primary" : inv.confidence >= 0.5 ? "text-yellow-400" : "text-muted-foreground")}>
                        {Math.round(inv.confidence * 100)}%
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No investigations yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Connect Datadog to start receiving alerts</p>
              </div>
            )}
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Integrations */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm">Integrations</h2>
              </div>
              <Link href="/dashboard/integrations" className="text-xs text-muted-foreground hover:text-primary">Manage</Link>
            </div>
            <div className="space-y-3">
              {(['datadog', 'github', 'slack'] as const).map((provider) => {
                const config = integrationConfig[provider]
                const Icon = config.icon
                const isConnected = integrationStatus(provider)
                return (
                  <div key={provider} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <div className={cn("h-8 w-8 rounded-md flex items-center justify-center", config.bgColor)}>
                      <Icon className="text-white" />
                </div>
                <div className="flex-1">
                      <div className="text-sm font-medium">{config.name}</div>
                      <div className="text-xs text-muted-foreground">{config.description}</div>
                </div>
                    <Badge variant="outline" className={cn("text-[10px]", isConnected ? "bg-primary/10 text-primary border-primary/30" : "")}>
                      {isConnected ? 'Connected' : 'Setup'}
                </Badge>
              </div>
                )
              })}
            </div>
          </Card>

          {/* Severity */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">By Severity</h2>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Critical', count: stats.bySeverity.critical, color: 'bg-red-500', textColor: 'text-red-400' },
                { label: 'High', count: stats.bySeverity.high, color: 'bg-orange-500', textColor: 'text-orange-400' },
                { label: 'Medium', count: stats.bySeverity.medium, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
                { label: 'Low', count: stats.bySeverity.low, color: 'bg-blue-500', textColor: 'text-blue-400' },
              ].map(sev => (
                <div key={sev.label} className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full", sev.color)} />
                  <span className="text-sm flex-1">{sev.label}</span>
                  <span className={cn("text-sm font-medium", sev.textColor)}>{sev.count}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Top Services */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Server className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Top Services</h2>
            </div>
            {stats.byService.length > 0 ? (
              <div className="space-y-2">
                {stats.byService.map(([service, count], i) => (
                  <div key={service} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-sm flex-1 truncate">{service}</span>
                    <Badge variant="outline" className="text-[10px]">{count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No service data yet</p>
            )}
          </Card>

          {/* Quick Actions */}
          <Card className="p-5 border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Quick Actions</h2>
            </div>
            <div className="space-y-2">
              <Link href="/dashboard/chat" className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 hover:border-primary/30 transition-all group">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">Ask Scout</div>
                  <div className="text-xs text-muted-foreground">Chat with your SRE agent</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
              <Link href="/dashboard/integrations" className="flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:bg-accent/50 hover:border-primary/30 transition-all group">
                <div className="p-1.5 rounded-md bg-muted">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium group-hover:text-primary transition-colors">Configure Webhook</div>
                  <div className="text-xs text-muted-foreground">Get your Datadog webhook URL</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
