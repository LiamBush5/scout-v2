'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Filter,
  X,
  Clock,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  CheckCircle,
  XCircle,
  Activity,
  Server,
  Calendar,
  ArrowUpDown,
  RotateCcw,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Investigation {
  id: string
  alertName: string
  monitorName: string | null
  service: string
  environment: string
  severity: string | null
  status: 'completed' | 'running' | 'failed' | 'queued'
  confidence: number | null
  summary: string | null
  rootCause: string | null
  createdAt: string
  durationMs: number | null
  feedback: 'helpful' | 'not_helpful' | null
  triggerType: string
}

type SortField = 'created_at' | 'confidence_score' | 'duration_ms' | 'service'
type SortOrder = 'asc' | 'desc'

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [serviceFilter, setServiceFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [feedbackFilter, setFeedbackFilter] = useState<string>('all')

  // Sorting
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    async function fetchInvestigations() {
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

      const { data } = await supabase
        .from('investigations')
        .select('*')
        .eq('org_id', profile.current_org_id)
        .order('created_at', { ascending: false })
        .limit(200)

      if (data) {
        setInvestigations(data.map(inv => ({
          id: inv.id,
          alertName: inv.alert_name || inv.monitor_name || 'Investigation',
          monitorName: inv.monitor_name,
          service: inv.service || 'Unknown',
          environment: inv.environment || 'prod',
          severity: inv.severity,
          status: inv.status as Investigation['status'],
          confidence: inv.confidence_score,
          summary: inv.summary,
          rootCause: inv.root_cause,
          createdAt: inv.created_at,
          durationMs: inv.duration_ms,
          feedback: inv.feedback_rating as Investigation['feedback'],
          triggerType: inv.trigger_type || 'manual',
        })))
      }

      setLoading(false)
    }

    fetchInvestigations()

    // Realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('investigations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investigations' },
        () => fetchInvestigations()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Get unique services for filter dropdown
  const uniqueServices = useMemo(() => {
    const services = new Set(investigations.map(inv => inv.service))
    return Array.from(services).sort()
  }, [investigations])

  // Apply filters and sorting
  const filteredInvestigations = useMemo(() => {
    let result = [...investigations]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(inv =>
        inv.alertName.toLowerCase().includes(query) ||
        inv.service.toLowerCase().includes(query) ||
        inv.summary?.toLowerCase().includes(query) ||
        inv.rootCause?.toLowerCase().includes(query)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(inv => inv.status === statusFilter)
    }

    // Severity filter
    if (severityFilter !== 'all') {
      result = result.filter(inv => inv.severity === severityFilter)
    }

    // Service filter
    if (serviceFilter !== 'all') {
      result = result.filter(inv => inv.service === serviceFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      let cutoff: Date

      switch (dateFilter) {
        case 'today':
          cutoff = new Date(now.setHours(0, 0, 0, 0))
          break
        case 'week':
          cutoff = new Date(now.setDate(now.getDate() - 7))
          break
        case 'month':
          cutoff = new Date(now.setMonth(now.getMonth() - 1))
          break
        default:
          cutoff = new Date(0)
      }

      result = result.filter(inv => new Date(inv.createdAt) >= cutoff)
    }

    // Feedback filter
    if (feedbackFilter !== 'all') {
      if (feedbackFilter === 'none') {
        result = result.filter(inv => !inv.feedback)
      } else {
        result = result.filter(inv => inv.feedback === feedbackFilter)
      }
    }

    // Sorting
    result.sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'created_at':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'confidence_score':
          comparison = (a.confidence || 0) - (b.confidence || 0)
          break
        case 'duration_ms':
          comparison = (a.durationMs || 0) - (b.durationMs || 0)
          break
        case 'service':
          comparison = a.service.localeCompare(b.service)
          break
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return result
  }, [investigations, searchQuery, statusFilter, severityFilter, serviceFilter, dateFilter, feedbackFilter, sortField, sortOrder])

  // Stats
  const stats = useMemo(() => {
    const completed = investigations.filter(inv => inv.status === 'completed')
    const helpful = completed.filter(inv => inv.feedback === 'helpful')
    const avgDuration = completed.reduce((sum, inv) => sum + (inv.durationMs || 0), 0) / (completed.length || 1)
    const avgConfidence = completed.reduce((sum, inv) => sum + (inv.confidence || 0), 0) / (completed.length || 1)

    return {
      total: investigations.length,
      completed: completed.length,
      running: investigations.filter(inv => inv.status === 'running').length,
      helpfulRate: completed.length > 0 ? (helpful.length / completed.length * 100).toFixed(0) : 0,
      avgDuration: avgDuration / 1000,
      avgConfidence: (avgConfidence * 100).toFixed(0),
    }
  }, [investigations])

  const activeFiltersCount = [
    statusFilter !== 'all',
    severityFilter !== 'all',
    serviceFilter !== 'all',
    dateFilter !== 'all',
    feedbackFilter !== 'all',
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSeverityFilter('all')
    setServiceFilter('all')
    setDateFilter('all')
    setFeedbackFilter('all')
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const formatTimeAgo = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
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
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30'
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      default: return ''
    }
  }

  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'text-muted-foreground'
    if (confidence >= 0.8) return 'text-primary'
    if (confidence >= 0.5) return 'text-yellow-400'
    return 'text-muted-foreground'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
      <h1 className="text-xl font-semibold">Investigations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredInvestigations.length} of {investigations.length} investigations
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.running}</div>
              <div className="text-xs text-muted-foreground">Running</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <ThumbsUp className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.helpfulRate}%</div>
              <div className="text-xs text-muted-foreground">Helpful</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/50">
      <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Zap className="h-4 w-4 text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.avgDuration.toFixed(0)}s</div>
              <div className="text-xs text-muted-foreground">Avg Duration</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filters */}
      <Card className="p-4 border-border/50">
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
              placeholder="Search by alert, service, summary, or root cause..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
        </div>

          {/* Filter Row */}
          <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[95px] h-8 text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-[110px] h-8 text-xs">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServices.map(service => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[95px] h-8 text-xs">
                <SelectValue placeholder="Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Past Week</SelectItem>
                <SelectItem value="month">Past Month</SelectItem>
              </SelectContent>
            </Select>

            <Select value={feedbackFilter} onValueChange={setFeedbackFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Feedback" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Feedback</SelectItem>
                <SelectItem value="helpful">Helpful</SelectItem>
                <SelectItem value="not_helpful">Not Helpful</SelectItem>
                <SelectItem value="none">No Feedback</SelectItem>
              </SelectContent>
            </Select>

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs px-2"
                onClick={clearFilters}
              >
                <X className="h-3 w-3 mr-1" />
                {activeFiltersCount}
              </Button>
            )}

            {/* Sort - pushed to right */}
            <div className="ml-auto flex items-center gap-1.5">
              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="w-[90px] h-8 text-xs">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date</SelectItem>
                  <SelectItem value="confidence_score">Confidence</SelectItem>
                  <SelectItem value="duration_ms">Duration</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
          </SelectContent>
        </Select>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              >
                <TrendingUp className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  sortOrder === 'asc' && "rotate-180"
                )} />
              </Button>
            </div>
          </div>
      </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredInvestigations.length > 0 ? (
        <div className="space-y-2">
          {filteredInvestigations.map((investigation) => (
            <Link
              key={investigation.id}
              href={`/dashboard/investigations/${investigation.id}`}
            >
              <Card className="p-4 border-border/50 hover:bg-accent/30 hover:border-primary/30 transition-all cursor-pointer group">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="pt-0.5">
                    {getStatusIcon(investigation.status)}
                  </div>

                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                        {investigation.alertName}
                      </h3>
                      {investigation.severity && (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5", getSeverityColor(investigation.severity))}
                        >
                          {investigation.severity}
                        </Badge>
                      )}
                      {investigation.feedback && (
                        investigation.feedback === 'helpful' ? (
                          <ThumbsUp className="h-3 w-3 text-primary" />
                        ) : (
                          <ThumbsDown className="h-3 w-3 text-destructive" />
                        )
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Server className="h-3 w-3" />
                        {investigation.service}
                      </span>
                      <span>·</span>
                      <span>{investigation.environment}</span>
                      <span>·</span>
                      <span className="capitalize">{investigation.triggerType.replace('_', ' ')}</span>
                    </div>

                    {investigation.rootCause && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <span className="text-destructive font-medium">Root cause:</span>{' '}
                        {investigation.rootCause}
                      </p>
                    )}
                    {!investigation.rootCause && investigation.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {investigation.summary}
                      </p>
                    )}
                  </div>

                  {/* Right Side Stats */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {investigation.confidence !== null && investigation.confidence > 0 && (
                      <span className={cn(
                        "text-sm font-semibold",
                        getConfidenceColor(investigation.confidence)
                      )}>
                        {Math.round(investigation.confidence * 100)}%
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(investigation.durationMs)}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimeAgo(investigation.createdAt)}
                    </span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : investigations.length === 0 ? (
        <Card className="p-12 text-center border-border/50">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No investigations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
            Investigations will appear here when alerts are received via the Datadog webhook.
          </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-12 text-center border-border/50">
          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-full bg-muted">
              <Filter className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No matching investigations</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting your filters or search query.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2">
              Clear Filters
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
