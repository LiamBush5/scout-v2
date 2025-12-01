'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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

interface Investigation {
  id: string
  title: string
  service: string
  status: 'completed' | 'running' | 'failed' | 'queued'
  confidence: number
  summary: string
  rootCause: string | null
  createdAt: string
  durationMs: number
  feedback: 'helpful' | 'not_helpful' | null
  findings: Finding[]
  suggestedActions: SuggestedAction[]
  langsmithUrl: string | null
}

export default function InvestigationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [investigation, setInvestigation] = useState<Investigation | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<'helpful' | 'not_helpful' | null>(null)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInvestigation() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('investigations')
        .select('*')
        .eq('id', params.id)
        .single()

      if (data) {
        setInvestigation({
          id: data.id,
          title: data.alert_name || data.monitor_name || 'Investigation',
          service: data.service || 'Unknown',
          status: data.status,
          confidence: data.confidence_score || 0,
          summary: data.summary || 'No summary available',
          rootCause: data.root_cause,
          createdAt: data.created_at,
          durationMs: data.duration_ms || 0,
          feedback: data.feedback_rating,
          findings: (data.findings as Finding[]) || [],
          suggestedActions: (data.suggested_actions as SuggestedAction[]) || [],
          langsmithUrl: data.langsmith_url,
        })
        setFeedback(data.feedback_rating)
      }

      setLoading(false)
    }

    fetchInvestigation()
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
      toast.success(`Thank you for your feedback!`)
    } catch {
      toast.error('Failed to save feedback')
    }
  }

  const handleCopyCommand = async (command: string) => {
    await navigator.clipboard.writeText(command)
    setCopiedCommand(command)
    toast.success('Command copied to clipboard')
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  const statusColors: Record<string, string> = {
    completed: 'bg-primary/10 text-primary border-primary/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    failed: 'bg-destructive/10 text-destructive border-destructive/20',
    queued: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!investigation) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          size="sm"
          className="h-8 text-xs -ml-2"
        >
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
    <div className="space-y-6">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => router.back()}
        size="sm"
        className="h-8 text-xs -ml-2"
      >
        <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-semibold">{investigation.title}</h1>
            <Badge
              variant="outline"
              className={statusColors[investigation.status] || statusColors.running}
            >
              {investigation.status}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{investigation.service}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(investigation.createdAt).toLocaleString()}
            </span>
            {investigation.durationMs > 0 && (
              <>
                <span>·</span>
                <span>{(investigation.durationMs / 1000).toFixed(1)}s</span>
              </>
            )}
          </div>
        </div>

        {/* Confidence indicator */}
        {investigation.confidence > 0 && (
          <div className="text-right">
            <div className="text-lg font-semibold">
              {Math.round(investigation.confidence * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">Confidence</div>
          </div>
        )}
      </div>

      {/* Summary */}
      <Card className="p-5 border-border/50">
        <h2 className="font-medium text-sm mb-3">Summary</h2>
        <p className="text-sm text-muted-foreground">{investigation.summary}</p>

        {investigation.rootCause && (
          <div className="mt-4 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive text-sm mb-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="font-medium">Root Cause</span>
            </div>
            <p className="text-sm text-muted-foreground">{investigation.rootCause}</p>
          </div>
        )}
      </Card>

      {/* Suggested Actions */}
      {investigation.suggestedActions.length > 0 && (
        <Card className="p-5 border-border/50">
          <h2 className="font-medium text-sm mb-4">Suggested Actions</h2>
          <div className="space-y-3">
            {investigation.suggestedActions.map((action, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50"
              >
                <div className="h-6 w-6 rounded-full bg-accent text-muted-foreground flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {action.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{action.action}</p>
                  {action.command && (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-muted/50 rounded text-xs font-mono truncate">
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
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Evidence / Findings */}
      {investigation.findings.length > 0 && (
        <Card className="p-5 border-border/50">
          <h2 className="font-medium text-sm mb-4">Evidence</h2>
          <div className="space-y-3">
            {investigation.findings.map((finding, index) => (
              <div key={index} className="p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px]">
                    {finding.category.replace('_', ' ')}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(finding.confidence * 100)}%
                  </span>
                </div>
                <p className="text-sm mb-3">{finding.description}</p>
                <div className="space-y-1.5">
                  {finding.evidence.map((ev, evIndex) => (
                    <div
                      key={evIndex}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <Terminal className="h-3 w-3 flex-shrink-0" />
                      <span className="flex-shrink-0">{ev.source}:</span>
                      <code className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px] truncate">
                        {JSON.stringify(ev.data)}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Feedback */}
      <Card className="p-5 border-border/50">
        <h2 className="font-medium text-sm mb-4">Was this investigation helpful?</h2>
        <div className="flex items-center gap-3">
          <Button
            variant={feedback === 'helpful' ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => handleFeedback('helpful')}
          >
            <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
            Helpful
          </Button>
          <Button
            variant={feedback === 'not_helpful' ? 'destructive' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => handleFeedback('not_helpful')}
          >
            <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
            Not Helpful
          </Button>

          {investigation.langsmithUrl && (
            <>
              <div className="h-6 w-px bg-border/50" />
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a
                  href={investigation.langsmithUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Trace
                  <ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
