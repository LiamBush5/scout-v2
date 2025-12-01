'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  GitBranch,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * GitHub settings props
 */
interface GitHubSettingsProps {
  metadata: Record<string, unknown>
  onUpdate: (metadata: Record<string, unknown>) => void
  onClose?: () => void
}

/**
 * GitHub integration settings panel
 *
 * Allows users to:
 * - View connected account info
 * - Select which repositories to track
 * - Refresh repository list
 */
export function GitHubSettings({ metadata, onUpdate, onClose }: GitHubSettingsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedRepos, setSelectedRepos] = useState<string[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  const account = metadata.account as string | undefined
  const repos = (metadata.repos as string[]) || []
  const savedSelectedRepos = (metadata.selected_repos as string[]) || []
  const installationId = metadata.installation_id as string | undefined

  // Initialize selected repos from metadata
  useEffect(() => {
    setSelectedRepos(savedSelectedRepos)
  }, [JSON.stringify(savedSelectedRepos)])

  // Track changes
  useEffect(() => {
    const currentSet = new Set(selectedRepos)
    const savedSet = new Set(savedSelectedRepos)
    const isDifferent =
      currentSet.size !== savedSet.size ||
      [...currentSet].some((repo) => !savedSet.has(repo))
    setHasChanges(isDifferent)
  }, [selectedRepos, savedSelectedRepos])

  const handleRefreshRepos = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch('/api/integrations/github/refresh', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        onUpdate({
          ...metadata,
          repos: data.repos,
          repo_count: data.repo_count,
        })
        toast.success('Repository list refreshed')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to refresh repositories')
      }
    } catch {
      toast.error('Failed to refresh repositories')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleRepoToggle = (repo: string) => {
    setSelectedRepos((prev) =>
      prev.includes(repo) ? prev.filter((r) => r !== repo) : [...prev, repo]
    )
  }

  const handleSelectAll = () => {
    setSelectedRepos([...repos])
  }

  const handleDeselectAll = () => {
    setSelectedRepos([])
  }

  const handleSaveRepos = async () => {
    setIsSaving(true)
    try {
      const res = await fetch('/api/integrations/github', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selected_repos: selectedRepos }),
      })
      if (res.ok) {
        onUpdate({ ...metadata, selected_repos: selectedRepos })
        toast.success('Repository selection saved')
        setHasChanges(false)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to save repository selection')
      }
    } catch {
      toast.error('Failed to save repository selection')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="p-5 ml-14 border-l-2 border-l-primary/50 border-border/50 bg-card/50">
      <div className="space-y-5">
        {/* Account info */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div>
            <p className="text-xs text-muted-foreground">Connected Account</p>
            <p className="text-sm font-medium">@{account || 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://github.com/${account}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              View Profile
              <ExternalLink className="h-3 w-3" />
            </a>
            {installationId && (
              <a
                href={`https://github.com/settings/installations/${installationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
              >
                App Settings
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Repository selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Tracked Repositories</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select repositories to monitor for deployments
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshRepos}
              disabled={isRefreshing}
              className="h-8 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Repo list */}
          <div className="border border-border/50 rounded-lg overflow-hidden">
            {/* Select all / none header */}
            {repos.length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border/50">
                <span className="text-xs text-muted-foreground">
                  {selectedRepos.length} of {repos.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-muted-foreground/50">·</span>
                  <button
                    onClick={handleDeselectAll}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Repo items */}
            <div className="max-h-64 overflow-y-auto">
              {repos.length > 0 ? (
                repos.map((repo) => (
                  <label
                    key={repo}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 cursor-pointer transition-colors border-b border-border/30 last:border-b-0"
                  >
                    <Checkbox
                      checked={selectedRepos.includes(repo)}
                      onCheckedChange={() => handleRepoToggle(repo)}
                    />
                    <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm truncate">{repo}</span>
                  </label>
                ))
              ) : (
                <div className="px-4 py-8 text-center">
                  <AlertCircle className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No repositories found</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Click refresh to load your repositories
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {hasChanges && (
              <Badge variant="secondary" className="text-[10px]">
                Unsaved changes
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 text-xs">
                Close
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSaveRepos}
              disabled={!hasChanges || isSaving}
              className="h-8 text-xs"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Save Selection
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

/**
 * Loading skeleton for GitHub settings
 */
export function GitHubSettingsSkeleton() {
  return (
    <Card className="p-5 ml-14 border-l-2 border-l-primary/50 border-border/50">
      <div className="space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </Card>
  )
}
