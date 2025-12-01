'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
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
import { DatadogSettings } from '@/components/integrations/datadog-settings'
import { DatadogForm } from '@/components/onboarding/datadog-form'
import { type DatadogCredentials } from '@/lib/validations/onboarding'
import { createClient } from '@/lib/supabase/client'
import { ROUTES } from '@/lib/constants'
import { toast } from 'sonner'
import { DatadogIcon, SlackIcon, GitHubIcon } from '@/components/icons/integrations'

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
    const [showDatadogForm, setShowDatadogForm] = useState(false)

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
                        icon={<GitHubIcon />}
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
                        icon={<SlackIcon />}
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
                        icon={<DatadogIcon />}
                        description="Query metrics, logs, and APM data"
                        status={integrationStatus.datadog.connected ? 'connected' : 'disconnected'}
                        connectedAccount={getConnectedAccount('datadog')}
                        onConnect={handleDatadogConnect}
                        onManage={() => handleManage('datadog')}
                        onDisconnect={() => handleDisconnectClick('datadog')}
                        isManaging={managingProvider === 'datadog'}
                    />
                </div>

                {/* Datadog Settings Panel */}
                {managingProvider === 'datadog' && integrationStatus.datadog.connected && (
                    <DatadogSettings
                        metadata={integrationStatus.datadog.metadata || {}}
                        onUpdate={(metadata) => handleMetadataUpdate('datadog', metadata)}
                        onClose={() => setManagingProvider(null)}
                    />
                )}
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
