'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Hash,
  Send,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Settings2,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

interface SlackChannel {
  id: string
  name: string
  is_private: boolean
}

interface SlackSettingsProps {
  metadata: Record<string, unknown>
  onUpdate: (metadata: Record<string, unknown>) => void
}

export function SlackSettings({ metadata, onUpdate }: SlackSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [channels, setChannels] = useState<SlackChannel[]>([])
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)
  const [selectedChannel, setSelectedChannel] = useState<string>(
    (metadata.channel_id as string) || ''
  )
  const [isSending, setIsSending] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const teamName = metadata.team_name as string
  const teamId = metadata.team_id as string
  const currentChannelName = metadata.channel_name as string

  useEffect(() => {
    if (isExpanded && channels.length === 0) {
      fetchChannels()
    }
  }, [isExpanded])

  const fetchChannels = async () => {
    setIsLoadingChannels(true)
    try {
      const res = await fetch('/api/integrations/slack/channels')
      if (res.ok) {
        const data = await res.json()
        setChannels(data.channels || [])
      } else {
        toast.error('Failed to load channels')
      }
    } catch {
      toast.error('Failed to load channels')
    } finally {
      setIsLoadingChannels(false)
    }
  }

  const handleSaveChannel = async () => {
    if (!selectedChannel) return

    setIsSaving(true)
    try {
      const res = await fetch('/api/integrations/slack', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel_id: selectedChannel }),
      })

      if (res.ok) {
        const channel = channels.find(c => c.id === selectedChannel)
        onUpdate({
          ...metadata,
          channel_id: selectedChannel,
          channel_name: channel?.name || selectedChannel,
        })
        toast.success('Notification channel updated')
      } else {
        toast.error('Failed to update channel')
      }
    } catch {
      toast.error('Failed to update channel')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSendTestMessage = async () => {
    setIsSending(true)
    try {
      const res = await fetch('/api/integrations/slack/test', { method: 'POST' })
      if (res.ok) {
        toast.success('Test message sent to Slack!')
      } else {
        const error = await res.json()
        toast.error(error.error || 'Failed to send test message')
      }
    } catch {
      toast.error('Failed to send test message')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="p-4 ml-14 border-l-2 border-l-green-500">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Slack Settings</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Workspace info */}
          <div className="flex items-center justify-between py-2 border-b">
            <div>
              <p className="text-sm font-medium">Connected Workspace</p>
              <p className="text-sm text-muted-foreground">{teamName}</p>
            </div>
            <a
              href={`https://app.slack.com/client/${teamId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Open Slack
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Notification channel */}
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Notification Channel</p>
              <p className="text-sm text-muted-foreground">
                Where investigation results will be posted
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={selectedChannel}
                onValueChange={setSelectedChannel}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a channel">
                    {selectedChannel && channels.length > 0 ? (
                      <span className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {channels.find(c => c.id === selectedChannel)?.name || currentChannelName}
                      </span>
                    ) : currentChannelName ? (
                      <span className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        {currentChannelName}
                      </span>
                    ) : (
                      'Select a channel'
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {isLoadingChannels ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Loading channels...
                    </div>
                  ) : channels.length > 0 ? (
                    channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <span className="flex items-center gap-2">
                          <Hash className="h-4 w-4" />
                          {channel.name}
                          {channel.is_private && (
                            <Badge variant="secondary" className="text-xs">Private</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))
                  ) : (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No channels found
                    </div>
                  )}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchChannels}
                disabled={isLoadingChannels}
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingChannels ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {selectedChannel && selectedChannel !== metadata.channel_id && (
              <Button
                size="sm"
                onClick={handleSaveChannel}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Channel
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Test message */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Test Connection</p>
                <p className="text-sm text-muted-foreground">
                  Send a test message to verify the integration
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendTestMessage}
                disabled={isSending}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Test
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
