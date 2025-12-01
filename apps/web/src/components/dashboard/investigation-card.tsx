'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Clock, ThumbsUp, ThumbsDown } from 'lucide-react'

interface Investigation {
  id: string
  title: string
  service: string
  status: 'completed' | 'running' | 'failed' | 'queued'
  confidence?: number
  summary?: string
  createdAt: string
  durationMs?: number
  feedback?: 'helpful' | 'not_helpful' | null
}

interface InvestigationCardProps {
  investigation: Investigation
}

export function InvestigationCard({ investigation }: InvestigationCardProps) {
  const statusColors = {
    completed: 'bg-primary/10 text-primary border-primary/20',
    running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    failed: 'bg-destructive/10 text-destructive border-destructive/20',
    queued: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const formatTime = (date: string) => {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
    return d.toLocaleDateString()
  }

  return (
    <Link href={`/dashboard/investigations/${investigation.id}`}>
      <Card className="p-4 border-border/50 hover:bg-accent/30 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{investigation.title}</h3>
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', statusColors[investigation.status])}
              >
                {investigation.status}
              </Badge>
              {investigation.feedback && (
                <span className="text-muted-foreground">
                  {investigation.feedback === 'helpful' ? (
                    <ThumbsUp className="h-3 w-3 text-primary" />
                  ) : (
                    <ThumbsDown className="h-3 w-3 text-destructive" />
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {investigation.service}
              {investigation.summary && (
                <span className="mx-1.5">·</span>
              )}
              {investigation.summary && (
                <span className="line-clamp-1">{investigation.summary}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 text-xs text-muted-foreground">
            {investigation.confidence && (
              <span>
                {Math.round(investigation.confidence * 100)}%
              </span>
            )}
            {investigation.durationMs && (
              <span>{formatDuration(investigation.durationMs)}</span>
            )}
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(investigation.createdAt)}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
