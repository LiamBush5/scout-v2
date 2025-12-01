'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

const DATADOG_SITES = [
  { value: 'datadoghq.com', label: 'US1 (datadoghq.com)' },
  { value: 'us3.datadoghq.com', label: 'US3 (us3.datadoghq.com)' },
  { value: 'us5.datadoghq.com', label: 'US5 (us5.datadoghq.com)' },
  { value: 'datadoghq.eu', label: 'EU (datadoghq.eu)' },
  { value: 'ap1.datadoghq.com', label: 'AP1 (ap1.datadoghq.com)' },
]

interface DatadogSettingsProps {
  metadata: Record<string, unknown>
  onUpdate: (metadata: Record<string, unknown>) => void
  onClose?: () => void
}

export function DatadogSettings({ metadata, onUpdate, onClose }: DatadogSettingsProps) {
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [showUpdateForm, setShowUpdateForm] = useState(false)
  const [newApiKey, setNewApiKey] = useState('')
  const [newAppKey, setNewAppKey] = useState('')
  const [newSite, setNewSite] = useState((metadata.site as string) || 'datadoghq.com')
  const [isUpdating, setIsUpdating] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  const site = (metadata.site as string) || 'datadoghq.com'
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sre-agent.vercel.app'}/api/webhooks/datadog`

  const handleVerifyConnection = async () => {
    setIsVerifying(true)
    setVerifyStatus('idle')
    try {
      const res = await fetch('/api/integrations/datadog/verify', { method: 'POST' })
      if (res.ok) {
        setVerifyStatus('success')
        toast.success('Datadog connection verified!')
      } else {
        setVerifyStatus('error')
        toast.error('Connection verification failed')
      }
    } catch {
      setVerifyStatus('error')
      toast.error('Failed to verify connection')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleUpdateCredentials = async () => {
    if (!newApiKey || !newAppKey) {
      toast.error('Please enter both API Key and App Key')
      return
    }

    setIsUpdating(true)
    try {
      const res = await fetch('/api/integrations/datadog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: newApiKey,
          appKey: newAppKey,
          site: newSite,
        }),
      })

      if (res.ok) {
        onUpdate({ ...metadata, site: newSite })
        setShowUpdateForm(false)
        setNewApiKey('')
        setNewAppKey('')
        setVerifyStatus('idle')
        toast.success('Datadog credentials updated!')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to update credentials')
      }
    } catch {
      toast.error('Failed to update credentials')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    toast.success('Webhook URL copied')
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  const getSiteLabel = (siteValue: string) => {
    return DATADOG_SITES.find(s => s.value === siteValue)?.label || siteValue
  }

  return (
    <Card className="p-5 border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium">Datadog Settings</h3>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {/* Site info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Connected Site</p>
            <p className="text-sm text-muted-foreground">{getSiteLabel(site)}</p>
          </div>
          <a
            href={`https://app.${site}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            Open Datadog
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Connection status */}
        <div className="flex items-center justify-between pb-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">API Status</p>
            {verifyStatus === 'success' && (
              <Badge variant="default" className="bg-green-500 text-[10px]">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verified
              </Badge>
            )}
            {verifyStatus === 'error' && (
              <Badge variant="destructive" className="text-[10px]">
                <AlertCircle className="h-3 w-3 mr-1" />
                Failed
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerifyConnection}
            disabled={isVerifying}
            className="h-8 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isVerifying ? 'animate-spin' : ''}`} />
            {isVerifying ? 'Verifying...' : 'Verify'}
          </Button>
        </div>

        {/* Webhook URL */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Webhook URL</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add this to your Datadog monitors to trigger investigations
            </p>
          </div>
          <div className="flex gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="h-9 font-mono text-xs bg-muted/30"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyWebhook}
              className="h-9 w-9 flex-shrink-0"
            >
              {webhookCopied ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={`https://app.${site}/monitors/manage`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              Manage Monitors
              <ExternalLink className="h-3 w-3" />
            </a>
            <a
              href={`https://app.${site}/integrations/webhooks`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              Webhooks Integration
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Update credentials */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">API Credentials</p>
              <p className="text-xs text-muted-foreground">
                Update your Datadog API and App keys
              </p>
            </div>
            {!showUpdateForm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpdateForm(true)}
                className="h-8 text-xs"
              >
                Update Keys
              </Button>
            )}
          </div>

          {showUpdateForm && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="space-y-2">
                <Label htmlFor="site" className="text-xs">Datadog Site</Label>
                <Select value={newSite} onValueChange={setNewSite}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATADOG_SITES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-xs">API Key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Enter new API Key"
                  value={newApiKey}
                  onChange={(e) => setNewApiKey(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appKey" className="text-xs">App Key</Label>
                <Input
                  id="appKey"
                  type="password"
                  placeholder="Enter new App Key"
                  value={newAppKey}
                  onChange={(e) => setNewAppKey(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowUpdateForm(false)
                    setNewApiKey('')
                    setNewAppKey('')
                    setNewSite(site)
                  }}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateCredentials}
                  disabled={isUpdating || !newApiKey || !newAppKey}
                  className="h-8 text-xs"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Credentials'
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

      </div>
    </Card>
  )
}
