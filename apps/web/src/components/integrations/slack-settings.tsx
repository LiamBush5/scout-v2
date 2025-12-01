'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
    Hash,
    Send,
    RefreshCw,
    ExternalLink,
    X,
    CheckCircle2,
    Lock,
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
    onClose?: () => void
}

export function SlackSettings({ metadata, onUpdate, onClose }: SlackSettingsProps) {
    const [channels, setChannels] = useState<SlackChannel[]>([])
    const [isLoadingChannels, setIsLoadingChannels] = useState(false)
    const [selectedChannels, setSelectedChannels] = useState<string[]>(
        (metadata.channel_ids as string[]) ||
        (metadata.channel_id ? [metadata.channel_id as string] : [])
    )
    const [isSending, setIsSending] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const teamName = metadata.team_name as string
    const teamId = metadata.team_id as string
    const savedChannelIds = (metadata.channel_ids as string[]) ||
        (metadata.channel_id ? [metadata.channel_id as string] : [])

    useEffect(() => {
        fetchChannels()
    }, [])

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

    const handleChannelToggle = (channelId: string) => {
        setSelectedChannels(prev =>
            prev.includes(channelId)
                ? prev.filter(id => id !== channelId)
                : [...prev, channelId]
        )
    }

    const handleSaveChannels = async () => {
        if (selectedChannels.length === 0) {
            toast.error('Please select at least one channel')
            return
        }

        setIsSaving(true)
        try {
            const res = await fetch('/api/integrations/slack', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel_ids: selectedChannels }),
            })

            if (res.ok) {
                const selectedChannelNames = channels
                    .filter(c => selectedChannels.includes(c.id))
                    .map(c => c.name)

                onUpdate({
                    ...metadata,
                    channel_ids: selectedChannels,
                    channel_names: selectedChannelNames,
                    // Keep backward compatibility
                    channel_id: selectedChannels[0],
                    channel_name: selectedChannelNames[0],
                })
                toast.success('Notification channels updated')
            } else {
                const error = await res.json()
                toast.error(error.error || 'Failed to update channels')
            }
        } catch {
            toast.error('Failed to update channels')
        } finally {
            setIsSaving(false)
        }
    }

    const handleSendTestMessage = async () => {
        if (selectedChannels.length === 0) {
            toast.error('Please select at least one channel first')
            return
        }

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

    const hasChanges = JSON.stringify(selectedChannels.sort()) !== JSON.stringify(savedChannelIds.sort())

    return (
        <Card className="p-5 border-border/50">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Slack Settings</h3>
                {onClose && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="space-y-5">
                {/* Workspace info */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium">Connected Workspace</p>
                        <p className="text-sm text-muted-foreground">{teamName}</p>
                    </div>
                    <a
                        href={`https://app.slack.com/client/${teamId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                    >
                        Open Slack
                        <ExternalLink className="h-3 w-3" />
                    </a>
                </div>

                {/* Channel selection */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Notification Channels</p>
                            <p className="text-xs text-muted-foreground">
                                Select channels where investigation results will be posted
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={fetchChannels}
                            disabled={isLoadingChannels}
                            className="h-8"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingChannels ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>

                    <div className="border rounded-lg max-h-[240px] overflow-y-auto">
                        {isLoadingChannels ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                                <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                                Loading channels...
                            </div>
                        ) : channels.length > 0 ? (
                            <div className="divide-y">
                                {channels.map((channel) => (
                                    <label
                                        key={channel.id}
                                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                        <Checkbox
                                            checked={selectedChannels.includes(channel.id)}
                                            onCheckedChange={() => handleChannelToggle(channel.id)}
                                        />
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {channel.is_private ? (
                                                <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                            ) : (
                                                <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                            )}
                                            <span className="text-sm truncate">{channel.name}</span>
                                            {channel.is_private && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                    Private
                                                </Badge>
                                            )}
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                                No channels found. Make sure the bot is invited to the channels.
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                            {selectedChannels.length} channel{selectedChannels.length !== 1 ? 's' : ''} selected
                        </p>
                        {hasChanges && (
                            <Button
                                size="sm"
                                onClick={handleSaveChannels}
                                disabled={isSaving || selectedChannels.length === 0}
                                className="h-8"
                            >
                                {isSaving ? (
                                    <>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Test message */}
                <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium">Test Connection</p>
                            <p className="text-xs text-muted-foreground">
                                Send a test message to verify the integration
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSendTestMessage}
                            disabled={isSending || selectedChannels.length === 0}
                            className="h-8"
                        >
                            {isSending ? (
                                <>
                                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="h-3.5 w-3.5 mr-1.5" />
                                    Send Test
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        </Card>
    )
}
