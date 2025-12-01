'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { IntegrationCard } from '@/components/onboarding/integration-card'
import { GitHubSettings } from '@/components/integrations/github-settings'
import { SlackSettings } from '@/components/integrations/slack-settings'
import { DatadogForm } from '@/components/onboarding/datadog-form'
import { type DatadogCredentials } from '@/lib/validations/onboarding'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/lib/constants'
import { toast } from 'sonner'
import {
    Copy,
    CheckCircle2,
    ExternalLink,
    Github,
    Loader2,
    XCircle,
} from 'lucide-react'

/**
 * Integration status type
 */
interface IntegrationData {
    connected: boolean
    metadata?: Record<string, unknown>
}

type IntegrationProvider = 'github' | 'slack' | 'datadog'

type IntegrationStatus = Record<IntegrationProvider, IntegrationData>

/**
 * Default integration status
 */
const defaultStatus: IntegrationStatus = {
    github: { connected: false },
    slack: { connected: false },
    datadog: { connected: false },
}

function IntegrationsPageContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    // State
    const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>(defaultStatus)
    const [isLoading, setIsLoading] = useState(true)
    const [connectingProvider, setConnectingProvider] = useState<string | null>(null)
    const [managingProvider, setManagingProvider] = useState<IntegrationProvider | null>(null)
    const [disconnectingProvider, setDisconnectingProvider] = useState<IntegrationProvider | null>(null)
    const [webhookCopied, setWebhookCopied] = useState(false)
    const [showDatadogForm, setShowDatadogForm] = useState(false)
    const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sre-agent.vercel.app'}/api/webhooks/datadog`

    // Handle OAuth callbacks from URL params
    useEffect(() => {
        const githubConnected = searchParams.get('github') === 'connected'
        const slackConnected = searchParams.get('slack') === 'connected'
        const error = searchParams.get('error')

        if (githubConnected) {
            toast.success('GitHub connected successfully!')
            // Refresh to get latest metadata
            fetchIntegrationStatus()
        }
        if (slackConnected) {
            toast.success('Slack connected successfully!')
        }

        if (error) {
            const errorMessages: Record<string, string> = {
                invalid_state: 'Authentication failed. Please try again.',
                no_installation: 'GitHub App installation was not completed.',
                github_failed: 'Failed to connect GitHub. Please try again.',
                slack_denied: 'Slack authorization was denied.',
                slack_failed: 'Failed to connect Slack. Please try again.',
                no_org: 'No organization found. Please complete signup first.',
            }
            toast.error(errorMessages[error] || 'Connection failed. Please try again.')
        }

        // Clear URL params after processing
        if (githubConnected || slackConnected || error) {
            router.replace(ROUTES.INTEGRATIONS)
        }
    }, [searchParams, router])

    // Fetch integration status from database
    const fetchIntegrationStatus = useCallback(async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) return

            const { data: profile } = await supabase
                .from('profiles')
                .select('current_org_id')
                .eq('id', user.id)
                .single()

            if (!profile?.current_org_id) return

            const { data: integrationsData } = await supabase
                .from('integrations')
                .select('provider, status, metadata')
                .eq('org_id', profile.current_org_id)

            if (integrationsData) {
                const status: IntegrationStatus = { ...defaultStatus }

                integrationsData.forEach((integration) => {
                    const provider = integration.provider as IntegrationProvider
                    if (provider in status) {
                        status[provider] = {
                            connected: integration.status === 'connected',
                            metadata: integration.metadata as Record<string, unknown>,
                        }
                    }
                })

                setIntegrationStatus(status)
            }
        } catch (error) {
            console.error('Failed to fetch integration status:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchIntegrationStatus()
    }, [fetchIntegrationStatus])

    // Connect handlers
    const handleGitHubConnect = async () => {
        setConnectingProvider('github')
        try {
            const res = await fetch('/api/integrations/github/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redirectTo: ROUTES.INTEGRATIONS }),
            })
            const { url, error } = await res.json()
            if (error) {
                toast.error(error)
                setConnectingProvider(null)
                return
            }
            if (url) window.location.href = url
        } catch {
            toast.error('Failed to initiate GitHub connection')
            setConnectingProvider(null)
        }
    }

    const handleSlackConnect = async () => {
        setConnectingProvider('slack')
        try {
            const res = await fetch('/api/integrations/slack/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ redirectTo: ROUTES.INTEGRATIONS }),
            })
            const { url, error } = await res.json()
            if (error) {
                toast.error(error)
                setConnectingProvider(null)
                return
            }
            if (url) window.location.href = url
        } catch {
            toast.error('Failed to initiate Slack connection')
            setConnectingProvider(null)
        }
    }

    const handleDatadogConnect = () => {
        setShowDatadogForm(true)
    }

    const handleDatadogSubmit = async (data: DatadogCredentials) => {
        try {
            const res = await fetch('/api/integrations/datadog', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to connect Datadog')
            }

            setIntegrationStatus((prev) => ({
                ...prev,
                datadog: { connected: true, metadata: { site: data.site } },
            }))
            setShowDatadogForm(false)
            toast.success('Datadog connected successfully!')
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to connect Datadog')
            throw error
        }
    }

    // Manage handlers
    const handleManage = (provider: IntegrationProvider) => {
        setManagingProvider(managingProvider === provider ? null : provider)
    }

    // Disconnect handlers
    const handleDisconnectClick = (provider: IntegrationProvider) => {
        setDisconnectingProvider(provider)
    }

    const handleDisconnectConfirm = async () => {
        if (!disconnectingProvider) return

        const provider = disconnectingProvider
        setDisconnectingProvider(null)

        try {
            const res = await fetch(`/api/integrations/${provider}`, { method: 'DELETE' })
            if (res.ok) {
                setIntegrationStatus((prev) => ({
                    ...prev,
                    [provider]: { connected: false, metadata: undefined },
                }))
                setManagingProvider(null)
                toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`)
            } else {
                const error = await res.json()
                toast.error(error.error || `Failed to disconnect ${provider}`)
            }
        } catch {
            toast.error(`Failed to disconnect ${provider}`)
        }
    }

    // Update metadata handler
    const handleMetadataUpdate = (provider: IntegrationProvider, newMetadata: Record<string, unknown>) => {
        setIntegrationStatus((prev) => ({
            ...prev,
            [provider]: {
                ...prev[provider],
                metadata: newMetadata,
            },
        }))
    }

    // Webhook copy handler
    const handleCopyWebhook = async () => {
        await navigator.clipboard.writeText(webhookUrl)
        setWebhookCopied(true)
        toast.success('Webhook URL copied')
        setTimeout(() => setWebhookCopied(false), 2000)
    }

    // Get connected account display text
    const getConnectedAccount = (provider: IntegrationProvider): string | undefined => {
        const status = integrationStatus[provider]
        if (!status.connected) return undefined

        const metadata = status.metadata
        if (!metadata) return 'Connected'

        switch (provider) {
            case 'github':
                return metadata.account ? `@${metadata.account}` : 'Connected'
            case 'slack':
                return metadata.team_name ? String(metadata.team_name) : 'Connected'
            case 'datadog':
                return metadata.site ? String(metadata.site) : 'Connected'
            default:
                return 'Connected'
        }
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="space-y-6">
                <h1 className="text-xl font-semibold">Integrations</h1>
                <div className="animate-pulse space-y-px rounded-lg overflow-hidden border border-border/50">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-[72px] bg-muted/20" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-xl font-semibold">Integrations</h1>

            {/* Integration cards */}
            <div className="space-y-2">
                {/* GitHub */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <IntegrationCard
                        name="GitHub"
                        icon={<Github className="h-5 w-5" />}
                        description="Connect GitHub for enhanced codebase context and deployment tracking"
                        status={
                            integrationStatus.github.connected
                                ? 'connected'
                                : connectingProvider === 'github'
                                    ? 'connecting'
                                    : 'disconnected'
                        }
                        connectedAccount={getConnectedAccount('github')}
                        onConnect={handleGitHubConnect}
                        onManage={() => handleManage('github')}
                        onDisconnect={() => handleDisconnectClick('github')}
                        isManaging={managingProvider === 'github'}
                    />
                </div>

                {/* GitHub Settings Panel */}
                {managingProvider === 'github' && integrationStatus.github.connected && (
                    <GitHubSettings
                        metadata={integrationStatus.github.metadata || {}}
                        onUpdate={(metadata) => handleMetadataUpdate('github', metadata)}
                        onClose={() => setManagingProvider(null)}
                    />
                )}

                {/* Slack */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <IntegrationCard
                        name="Slack"
                        logo="https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png"
                        description="Receive investigation results and alerts in Slack"
                        status={
                            integrationStatus.slack.connected
                                ? 'connected'
                                : connectingProvider === 'slack'
                                    ? 'connecting'
                                    : 'disconnected'
                        }
                        connectedAccount={getConnectedAccount('slack')}
                        onConnect={handleSlackConnect}
                        onManage={() => handleManage('slack')}
                        onDisconnect={() => handleDisconnectClick('slack')}
                        isManaging={managingProvider === 'slack'}
                    />
                </div>

                {/* Slack Settings Panel */}
                {managingProvider === 'slack' && integrationStatus.slack.connected && (
                    <SlackSettings
                        metadata={integrationStatus.slack.metadata || {}}
                        onUpdate={(metadata) => handleMetadataUpdate('slack', metadata)}
                        onClose={() => setManagingProvider(null)}
                    />
                )}

                {/* Datadog */}
                <div className="rounded-lg border border-border/50 overflow-hidden">
                    <IntegrationCard
                        name="Datadog"
                        logo="https://imgix.datadoghq.com/img/dd_logo_70x75.png"
                        description="Query metrics, logs, and APM data"
                        status={integrationStatus.datadog.connected ? 'connected' : 'disconnected'}
                        connectedAccount={getConnectedAccount('datadog')}
                        onConnect={handleDatadogConnect}
                        onDisconnect={() => handleDisconnectClick('datadog')}
                    />
                </div>
            </div>

            {/* Inline Datadog form */}
            {showDatadogForm && !integrationStatus.datadog.connected && (
                <Card className="p-5 border-border/50">
                    <DatadogForm
                        onSubmit={handleDatadogSubmit}
                        onCancel={() => setShowDatadogForm(false)}
                    />
                </Card>
            )}

            {/* Webhook configuration */}
            {integrationStatus.datadog.connected && (
                <Card className="p-5 border-border/50 space-y-4">
                    <div>
                        <p className="text-sm font-medium">Datadog Webhook URL</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Add this webhook to your Datadog monitors to automatically trigger Scout investigations.
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
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Step 1: Create the Webhook</p>
                        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                            <li>Go to <a href="https://app.datadoghq.com/integrations?search=webhooks" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">Integrations → Webhooks</a> and click the <span className="font-medium text-foreground">Webhooks</span> tile</li>
                            <li>Go to the <span className="font-medium text-foreground">Configure</span> tab and click <span className="font-medium text-foreground">+ New</span></li>
                            <li>Enter <span className="font-mono bg-muted/50 px-1 rounded">scout</span> as the Name and paste the URL above</li>
                            <li>Replace the Payload with the template below and click <span className="font-medium text-foreground">Save</span></li>
                        </ol>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Webhook Payload:</p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
                                    onClick={async () => {
                                        const payload = JSON.stringify({
                                            alert_id: "$ALERT_ID",
                                            alert_title: "$ALERT_TITLE",
                                            alert_transition: "$ALERT_TRANSITION",
                                            body: "$EVENT_MSG",
                                            tags: "$TAGS",
                                            link: "$LINK",
                                            priority: "$PRIORITY"
                                        }, null, 4)
                                        await navigator.clipboard.writeText(payload)
                                        toast.success('Payload copied')
                                    }}
                                >
                                    <Copy className="h-3 w-3 mr-1" />
                                    Copy
                                </Button>
                            </div>
                            <pre className="text-xs bg-muted/30 p-3 rounded-md overflow-x-auto font-mono text-muted-foreground">{`{
    "alert_id": "$ALERT_ID",
    "alert_title": "$ALERT_TITLE",
    "alert_transition": "$ALERT_TRANSITION",
    "body": "$EVENT_MSG",
    "tags": "$TAGS",
    "link": "$LINK",
    "priority": "$PRIORITY"
}`}</pre>
                        </div>
                    </div>
                    <div className="space-y-3 pt-2 border-t border-border/50">
                        <p className="text-xs font-medium text-muted-foreground">Step 2: Test the Connection</p>
                        <p className="text-xs text-muted-foreground">
                            After creating the webhook, click below to send a test alert and verify everything is working.
                        </p>
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs"
                                disabled={testStatus === 'loading'}
                                onClick={async () => {
                                    setTestStatus('loading')
                                    try {
                                        const res = await fetch('/api/webhooks/datadog/test', {
                                            method: 'POST',
                                        })
                                        if (res.ok) {
                                            setTestStatus('success')
                                            setTimeout(() => setTestStatus('idle'), 3000)
                                        } else {
                                            setTestStatus('error')
                                            setTimeout(() => setTestStatus('idle'), 3000)
                                        }
                                    } catch {
                                        setTestStatus('error')
                                        setTimeout(() => setTestStatus('idle'), 3000)
                                    }
                                }}
                            >
                                {testStatus === 'loading' && (
                                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                )}
                                {testStatus === 'success' && (
                                    <CheckCircle2 className="h-3 w-3 mr-1.5 text-green-500" />
                                )}
                                {testStatus === 'error' && (
                                    <XCircle className="h-3 w-3 mr-1.5 text-red-500" />
                                )}
                                {testStatus === 'idle' && 'Test Connection'}
                                {testStatus === 'loading' && 'Testing...'}
                                {testStatus === 'success' && 'Success!'}
                                {testStatus === 'error' && 'Failed'}
                            </Button>
                            {testStatus === 'success' && (
                                <a
                                    href="/dashboard"
                                    className="text-xs text-primary hover:underline"
                                >
                                    View investigation →
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                        <a
                            href="https://app.datadoghq.com/integrations?search=webhooks"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                        >
                            Open Integrations
                            <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                            href="https://app.datadoghq.com/monitors/manage"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                        >
                            Manage Monitors
                            <ExternalLink className="h-3 w-3" />
                        </a>
                        <a
                            href="https://docs.datadoghq.com/integrations/webhooks/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                        >
                            Documentation
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </Card>
            )}

            {/* Disconnect confirmation dialog */}
            <AlertDialog
                open={!!disconnectingProvider}
                onOpenChange={(open) => !open && setDisconnectingProvider(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Disconnect {disconnectingProvider}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the {disconnectingProvider} integration from your organization.
                            You can reconnect it at any time.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDisconnectConfirm}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Disconnect
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

export default function IntegrationsPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-6">
                    <h1 className="text-xl font-semibold">Integrations</h1>
                    <div className="animate-pulse space-y-px rounded-lg overflow-hidden border border-border/50">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-[72px] bg-muted/20" />
                        ))}
                    </div>
                </div>
            }
        >
            <IntegrationsPageContent />
        </Suspense>
    )
}
