'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  GitCommit,
  GitBranch,
  User,
  Calendar,
  Zap,
  Shield,
  Activity,
  FileText,
  History,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Server,
  BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Finding {
  category: string
  description: string
  confidence: number
  evidence: Array<{
    type: string
    source: string
    data: Record<string, unknown>
  }>
}

interface SuggestedAction {
  priority: number
  action: string
  command?: string
  automated: boolean
}

interface Deployment {
  sha: string
  message: string
  author: string
  timestamp: string
  files_changed?: number
  additions?: number
  deletions?: number
}

interface Investigation {
  id: string
  title: string
  monitorName: string | null
  monitorId: string | null
  service: string
  environment: string
  severity: string | null
  status: 'completed' | 'running' | 'failed' | 'queued'
  triggerType: string
  confidence: number
  summary: string
  rootCause: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  durationMs: number
  feedback: 'helpful' | 'not_helpful' | null
  feedbackComment: string | null
  findings: Finding[]
  suggestedActions: SuggestedAction[]
  deploymentsFound: Deployment[]
  langsmithUrl: string | null
  toolCalls: number
  triggerPayload: Record<string, unknown> | null
}

interface SimilarIncident {
  id: string
  alert_name: string
  service: string
  root_cause: string | null
  confidence_score: number
  created_at: string
  feedback_rating: string | null
}

export default function InvestigationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [similarIncidents, setSimilarIncidents] = useState<SimilarIncident[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [showCommentInput, setShowCommentInput] = useState(false)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Fetch the investigation
      const { data } = await supabase
        .from('investigations')
        .select('*')
        .eq('id', params.id)
        .single()

      if (data) {
        const inv: Investigation = {
          id: data.id,
          title: data.alert_name || data.monitor_name || 'Investigation',
          monitorName: data.monitor_name,
          monitorId: data.monitor_id,
          service: data.service || 'Unknown',
          environment: data.environment || 'prod',
          severity: data.severity,
          status: data.status,
          triggerType: data.trigger_type || 'manual',
          confidence: data.confidence_score || 0,
          summary: data.summary || 'No summary available',
          rootCause: data.root_cause,
          createdAt: data.created_at,
          startedAt: data.started_at,
          completedAt: data.completed_at,
          durationMs: data.duration_ms || 0,
          feedback: data.feedback_rating,
          feedbackComment: data.feedback_comment,
          findings: (data.findings as Finding[]) || [],
          suggestedActions: (data.suggested_actions as SuggestedAction[]) || [],
          deploymentsFound: (data.deployments_found as Deployment[]) || [],
          langsmithUrl: data.langsmith_url,
          toolCalls: data.tool_calls || 0,
          triggerPayload: data.trigger_payload,
        }
        setInvestigation(inv)
        setFeedback(data.feedback_rating)
        setFeedbackComment(data.feedback_comment || '')

        // Fetch similar past incidents
        if (inv.service) {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          const { data: similar } = await supabase
            .from('investigations')
            .select('id, alert_name, service, root_cause, confidence_score, created_at, feedback_rating')
            .eq('status', 'completed')
            .eq('org_id', data.org_id)
            .neq('id', data.id)
            .or(`service.ilike.%${inv.service}%,alert_name.ilike.%${inv.title}%`)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(5)

          if (similar) {
            setSimilarIncidents(similar)
          }
        }
      }

      setLoading(false)
    }

    fetchData()
  }, [params.id])

  const handleFeedback = async (value: 'helpful' | 'not_helpful') => {
    try {
      const supabase = createClient()
      await supabase
        .from('investigations')
        .update({
          feedback_rating: value,
          feedback_at: new Date().toISOString(),
        })
        .eq('id', params.id)

      setFeedback(value)
      if (value === 'not_helpful') {
        setShowCommentInput(true)
      } else {
        toast.success('Thank you for your feedback!')
      }
    } catch {
      toast.error('Failed to save feedback')
    }
  }

  const handleSaveComment = async () => {
    try {
      const supabase = createClient()
      await supabase
        .from('investigations')
        .update({ feedback_comment: feedbackComment })
        .eq('id', params.id)

      setShowCommentInput(false)
      toast.success('Feedback saved. We\'ll use this to improve.')
    } catch {
      toast.error('Failed to save comment')
    }
  }

  const handleCopyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(command)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const formatDuration = (ms: number) => {
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
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays < 7) return `${diffDays} days ago`
    return d.toLocaleDateString()
  }

  const getSeverityColor = (severity: string | null) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return 'bg-red-500/10 text-red-400 border-red-500/30'
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/30'
      case 'medium': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
      case 'low': return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      default: return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-primary" />
      case 'running': return <Activity className="h-4 w-4 text-blue-400 animate-pulse" />
      case 'failed': return <XCircle className="h-4 w-4 text-destructive" />
      default: return <Clock className="h-4 w-4 text-yellow-400" />
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-primary'
    if (confidence >= 0.5) return 'text-yellow-400'
    return 'text-muted-foreground'
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!investigation) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()} size="sm" className="h-8 text-xs -ml-2">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Back
        </Button>
        <Card className="p-8 text-center border-border/50">
          <p className="text-sm text-muted-foreground">Investigation not found</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.back()} size="sm" className="h-8 text-xs -ml-2">
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back to Investigations
      </Button>

      {/* ============================================================ */}
      {/* HEADER - Executive Summary */}
      {/* ============================================================ */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {getStatusIcon(investigation.status)}
              <h1 className="text-xl font-semibold">{investigation.title}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">
                <Server className="h-3 w-3 mr-1" />
                {investigation.service}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {investigation.environment}
              </Badge>
              {investigation.severity && (
                <Badge variant="outline" className={`text-xs ${getSeverityColor(investigation.severity)}`}>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {investigation.severity}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {investigation.triggerType.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          {/* Confidence Score - Large */}
          {investigation.confidence > 0 && (
            <div className="text-center px-4 py-2 rounded-lg border border-border/50 bg-card">
              <div className={`text-2xl font-bold ${getConfidenceColor(investigation.confidence)}`}>
                {Math.round(investigation.confidence * 100)}%
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Confidence
              </div>
            </div>
          )}
        </div>

        {/* Quick Stats Bar */}
        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(investigation.createdAt).toLocaleString()}
          </div>
          {investigation.durationMs > 0 && (
            <div className="flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5" />
              {formatDuration(investigation.durationMs)}
            </div>
          )}
          {investigation.toolCalls > 0 && (
            <div className="flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5" />
              {investigation.toolCalls} tool calls
            </div>
          )}
          {investigation.langsmithUrl && (
            <a
              href={investigation.langsmithUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Trace
            </a>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ROOT CAUSE - The Most Important Section */}
      {/* ============================================================ */}
      {investigation.rootCause && (
        <Card className="p-6 border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-destructive/10">
              <Target className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="font-semibold text-base">Root Cause Identified</h2>
                <Badge variant="outline" className={`text-[10px] ${getConfidenceColor(investigation.confidence)}`}>
                  {investigation.confidence >= 0.8 ? 'HIGH' : investigation.confidence >= 0.5 ? 'MEDIUM' : 'LOW'} CONFIDENCE
                </Badge>
              </div>
              <p className="text-sm leading-relaxed">{investigation.rootCause}</p>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* SUMMARY */}
      {/* ============================================================ */}
      <Card className="p-6 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Investigation Summary</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {investigation.summary}
        </p>
      </Card>

      {/* ============================================================ */}
      {/* TWO COLUMN LAYOUT */}
      {/* ============================================================ */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* ============================================================ */}
        {/* SUGGESTED ACTIONS */}
        {/* ============================================================ */}
        <Card className="p-6 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-base">Recommended Actions</h2>
          </div>

          {investigation.suggestedActions.length > 0 ? (
            <div className="space-y-4">
              {investigation.suggestedActions
                .sort((a, b) => a.priority - b.priority)
                .map((action, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      action.priority === 1 ? 'bg-primary text-primary-foreground' :
                      action.priority === 2 ? 'bg-primary/20 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {action.priority}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{action.action}</p>
                      {action.command && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="flex-1 px-3 py-2 bg-[#0d0d0d] rounded-md text-xs font-mono text-primary/90 border border-border/50 truncate">
                            {action.command}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 flex-shrink-0"
                            onClick={() => handleCopyCommand(action.command!)}
                          >
                            {copiedCommand === action.command ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                      {action.automated && (
                        <Badge variant="outline" className="mt-2 text-[10px]">
                          <Zap className="h-2.5 w-2.5 mr-1" />
                          Can be automated
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No specific actions recommended.</p>
          )}
        </Card>

        {/* ============================================================ */}
        {/* RELATED DEPLOYMENTS */}
        {/* ============================================================ */}
        <Card className="p-6 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="h-4 w-4 text-blue-400" />
            <h2 className="font-semibold text-base">Related Deployments</h2>
          </div>

          {investigation.deploymentsFound.length > 0 ? (
            <div className="space-y-3">
              {investigation.deploymentsFound.map((deploy, index) => (
                <div key={index} className="p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-start gap-3">
                    <GitCommit className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono text-primary">{deploy.sha?.slice(0, 7)}</code>
                        {index === 0 && (
                          <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                            PRIME SUSPECT
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm truncate">{deploy.message}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {deploy.author}
                        </span>
                        {deploy.timestamp && (
                          <span>{formatTimeAgo(deploy.timestamp)}</span>
                        )}
                        {deploy.files_changed && (
                          <span>{deploy.files_changed} files</span>
                        )}
                        {(deploy.additions || deploy.deletions) && (
                          <span>
                            <span className="text-green-400">+{deploy.additions || 0}</span>
                            {' / '}
                            <span className="text-red-400">-{deploy.deletions || 0}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent deployments found in the investigation window.</p>
          )}
        </Card>
      </div>

      {/* ============================================================ */}
      {/* EVIDENCE & FINDINGS */}
      {/* ============================================================ */}
      {investigation.findings.length > 0 && (
        <Card className="p-6 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-base">Evidence & Findings</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {investigation.findings.map((finding, index) => (
              <div key={index} className="p-4 rounded-lg border border-border/50 bg-muted/10">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="text-[10px]">
                    {finding.category.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                  <span className={`text-xs font-medium ${getConfidenceColor(finding.confidence)}`}>
                    {Math.round(finding.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm mb-3">{finding.description}</p>
                {finding.evidence.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-border/30">
                    {finding.evidence.slice(0, 2).map((ev, evIndex) => (
                      <div key={evIndex} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Terminal className="h-3 w-3 flex-shrink-0 mt-0.5" />
                        <span className="font-medium flex-shrink-0">{ev.source}:</span>
                        <code className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px] truncate">
                          {typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data).slice(0, 50)}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ============================================================ */}
      {/* SIMILAR PAST INCIDENTS */}
      {/* ============================================================ */}
      {similarIncidents.length > 0 && (
        <Card className="p-6 border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-base">Similar Past Incidents</h2>
            <Badge variant="outline" className="text-[10px] ml-2">
              Last 30 days
            </Badge>
          </div>
          <div className="space-y-3">
            {similarIncidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-start justify-between gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/investigations/${incident.id}`)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium truncate">{incident.alert_name}</span>
                    {incident.feedback_rating === 'helpful' && (
                      <ThumbsUp className="h-3 w-3 text-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {incident.root_cause || 'Root cause not identified'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-medium ${getConfidenceColor(incident.confidence_score)}`}>
                    {Math.round((incident.confidence_score || 0) * 100)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimeAgo(incident.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" />
            Use similar incidents to identify patterns and recurring issues
          </p>
        </Card>
      )}

      {/* ============================================================ */}
      {/* TIMELINE */}
      {/* ============================================================ */}
      <Card className="p-6 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Investigation Timeline</h2>
        </div>
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4 pl-8">
            <div className="relative">
              <div className="absolute -left-5 w-2.5 h-2.5 rounded-full bg-yellow-500 ring-4 ring-background" />
              <div className="text-sm font-medium">Alert Received</div>
              <div className="text-xs text-muted-foreground">
                {new Date(investigation.createdAt).toLocaleString()}
              </div>
            </div>
            {investigation.startedAt && (
              <div className="relative">
                <div className="absolute -left-5 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-background" />
                <div className="text-sm font-medium">Investigation Started</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(investigation.startedAt).toLocaleString()}
                </div>
              </div>
            )}
            {investigation.completedAt && (
              <div className="relative">
                <div className="absolute -left-5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-background" />
                <div className="text-sm font-medium">Investigation Completed</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(investigation.completedAt).toLocaleString()}
                  {investigation.durationMs > 0 && (
                    <span className="ml-2 text-primary">
                      ({formatDuration(investigation.durationMs)})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* ============================================================ */}
      {/* FEEDBACK */}
      {/* ============================================================ */}
      <Card className="p-6 border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-base">Feedback & Learning</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Your feedback helps Scout learn and improve future investigations.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant={feedback === 'helpful' ? 'default' : 'outline'}
            size="sm"
            className="h-9"
            onClick={() => handleFeedback('helpful')}
          >
            <ThumbsUp className="mr-2 h-4 w-4" />
            Helpful
          </Button>
          <Button
            variant={feedback === 'not_helpful' ? 'destructive' : 'outline'}
            size="sm"
            className="h-9"
            onClick={() => handleFeedback('not_helpful')}
          >
            <ThumbsDown className="mr-2 h-4 w-4" />
            Not Helpful
          </Button>
        </div>

        {showCommentInput && (
          <div className="mt-4 space-y-3">
            <textarea
              className="w-full p-3 rounded-lg border border-border bg-muted/20 text-sm resize-none"
              rows={3}
              placeholder="What could have been better? (optional)"
              value={feedbackComment}
              onChange={(e) => setFeedbackComment(e.target.value)}
            />
            <Button size="sm" onClick={handleSaveComment}>
              Save Feedback
            </Button>
          </div>
        )}

        {feedback && !showCommentInput && (
          <div className="mt-4 p-3 rounded-lg bg-muted/20 border border-border/50">
            <div className="flex items-center gap-2 text-sm">
              {feedback === 'helpful' ? (
                <CheckCircle className="h-4 w-4 text-primary" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              )}
              <span>
                {feedback === 'helpful'
                  ? 'Thanks! This helps Scout learn patterns that work.'
                  : 'Thanks for letting us know. We\'ll use this to improve.'}
              </span>
            </div>
            {feedbackComment && (
              <p className="text-xs text-muted-foreground mt-2 pl-6">
                "{feedbackComment}"
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
