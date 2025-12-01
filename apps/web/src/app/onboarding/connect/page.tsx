'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Stepper } from '@/components/ui/stepper'
import { IntegrationCard } from '@/components/onboarding/integration-card'
import { DatadogForm } from '@/components/onboarding/datadog-form'
import { useOnboardingStore } from '@/lib/stores/onboarding'
import { createClient } from '@/lib/supabase/client'
import { type DatadogCredentials } from '@/lib/validations/onboarding'
import { Github, MessageSquare, Activity, ArrowLeft, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'connect', title: 'Connect' },
  { id: 'setup', title: 'Setup' },
]

interface IntegrationStatus {
  github: { connected: boolean; metadata?: Record<string, unknown> }
  slack: { connected: boolean; metadata?: Record<string, unknown> }
  datadog: { connected: boolean; metadata?: Record<string, unknown> }
}

function ConnectPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setIntegration, nextStep, prevStep } = useOnboardingStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus>({
    github: { connected: false },
    slack: { connected: false },
    datadog: { connected: false },
  })
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)
  const [showDatadogForm, setShowDatadogForm] = useState(false)

  // Fetch integration status from database
  useEffect(() => {
    async function fetchIntegrationStatus() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return

        // Get user's current org
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_org_id')
          .eq('id', user.id)
          .single()

        if (!profile?.current_org_id) return

        // Fetch integrations for this org
        const { data: integrationsData } = await supabase
          .from('integrations')
          .select('provider, status, metadata')
          .eq('org_id', profile.current_org_id)

        if (integrationsData) {
          const status: IntegrationStatus = {
            github: { connected: false },
            slack: { connected: false },
            datadog: { connected: false },
          }

          integrationsData.forEach((integration) => {
            const provider = integration.provider as keyof IntegrationStatus
            if (provider in status) {
              status[provider] = {
                connected: integration.status === 'connected',
                metadata: integration.metadata as Record<string, unknown>,
              }
              // Also update the store
              if (integration.status === 'connected') {
                setIntegration(provider, true)
              }
            }
          })

          setIntegrationStatus(status)
        }
      } catch (error) {
        console.error('Failed to fetch integration status:', error)
      } finally {
        setIsLoadingStatus(false)
      }
    }

    fetchIntegrationStatus()
  }, [setIntegration])

  // Handle OAuth callbacks from URL params
  useEffect(() => {
    const githubConnected = searchParams.get('github') === 'connected'
    const slackConnected = searchParams.get('slack') === 'connected'
    const datadogConnected = searchParams.get('datadog') === 'connected'
    const error = searchParams.get('error')

    if (githubConnected) {
      setIntegration('github', true)
      setIntegrationStatus((prev) => ({ ...prev, github: { connected: true } }))
      toast.success('GitHub connected successfully!')
    }
    if (slackConnected) {
      setIntegration('slack', true)
      setIntegrationStatus((prev) => ({ ...prev, slack: { connected: true } }))
      toast.success('Slack connected successfully!')
    }
    if (datadogConnected) {
      setIntegration('datadog', true)
      setIntegrationStatus((prev) => ({ ...prev, datadog: { connected: true } }))
      toast.success('Datadog connected successfully!')
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
    if (githubConnected || slackConnected || datadogConnected || error) {
      router.replace('/onboarding/connect')
    }
  }, [searchParams, setIntegration, router])

  const handleGitHubConnect = async () => {
    setLoading('github')
    try {
      const res = await fetch('/api/integrations/github/install', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) {
        toast.error(error)
        setLoading(null)
        return
      }
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error)
      toast.error('Failed to connect GitHub')
      setLoading(null)
    }
  }

  const handleSlackConnect = async () => {
    setLoading('slack')
    try {
      const res = await fetch('/api/integrations/slack/install', { method: 'POST' })
      const { url, error } = await res.json()
      if (error) {
        toast.error(error)
        setLoading(null)
        return
      }
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Failed to initiate Slack OAuth:', error)
      toast.error('Failed to connect Slack')
      setLoading(null)
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

      setIntegration('datadog', true)
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

  const handleDisconnect = async (provider: 'github' | 'slack' | 'datadog') => {
    try {
      const res = await fetch(`/api/integrations/${provider}`, { method: 'DELETE' })
      if (res.ok) {
        setIntegration(provider, false)
        setIntegrationStatus((prev) => ({
          ...prev,
          [provider]: { connected: false },
        }))
        toast.success(`${provider.charAt(0).toUpperCase() + provider.slice(1)} disconnected`)
      } else {
        toast.error(`Failed to disconnect ${provider}`)
      }
    } catch (error) {
      console.error(`Failed to disconnect ${provider}:`, error)
      toast.error(`Failed to disconnect ${provider}`)
    }
  }

  const handleContinue = () => {
    nextStep()
    router.push('/onboarding/setup')
  }

  const handleSkip = () => {
    // Skip setup and go directly to dashboard
    router.push('/dashboard')
  }

  const handleBack = () => {
    prevStep()
    router.push('/onboarding/welcome')
  }

  const canContinue = integrationStatus.github.connected ||
    integrationStatus.slack.connected ||
    integrationStatus.datadog.connected

  const getConnectedAccount = (provider: keyof IntegrationStatus) => {
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

  if (isLoadingStatus) {
    return (
      <div className="max-w-2xl mx-auto">
        <Stepper steps={steps} currentStep={1} className="mb-12" />
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-2/3"></div>
          <div className="space-y-4 mt-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Stepper steps={steps} currentStep={1} className="mb-12" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Connect your tools</h1>
        <p className="text-muted-foreground">
          Connect integrations to enhance Scout's capabilities. You can skip this step and set up integrations later.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <IntegrationCard
          name="GitHub"
          icon={<Github className="h-6 w-6" />}
          description="Track deployments and correlate code changes with incidents"
          status={
            integrationStatus.github.connected
              ? 'connected'
              : loading === 'github'
                ? 'connecting'
                : 'disconnected'
          }
          connectedAccount={getConnectedAccount('github')}
          onConnect={handleGitHubConnect}
          onDisconnect={() => handleDisconnect('github')}
        />

        <IntegrationCard
          name="Slack"
          icon={<MessageSquare className="h-6 w-6" />}
          description="Receive investigation results and alerts in Slack"
          status={
            integrationStatus.slack.connected
              ? 'connected'
              : loading === 'slack'
                ? 'connecting'
                : 'disconnected'
          }
          connectedAccount={getConnectedAccount('slack')}
          onConnect={handleSlackConnect}
          onDisconnect={() => handleDisconnect('slack')}
        />

        <div className="space-y-4">
          <IntegrationCard
            name="Datadog"
            icon={<Activity className="h-6 w-6" />}
            description="Query metrics, logs, and APM data for investigations"
            status={integrationStatus.datadog.connected ? 'connected' : 'disconnected'}
            connectedAccount={getConnectedAccount('datadog')}
            onConnect={handleDatadogConnect}
            onDisconnect={() => handleDisconnect('datadog')}
          />

          {/* Inline Datadog form */}
          {showDatadogForm && !integrationStatus.datadog.connected && (
            <Card className="p-6 ml-14 border-l-2 border-l-primary">
              <DatadogForm
                onSubmit={handleDatadogSubmit}
                onCancel={() => setShowDatadogForm(false)}
              />
            </Card>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleSkip}>
            Skip for now
          </Button>
          <Button onClick={handleContinue}>
            Continue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="max-w-2xl mx-auto animate-pulse">Loading...</div>}>
      <ConnectPageContent />
    </Suspense>
  )
}
