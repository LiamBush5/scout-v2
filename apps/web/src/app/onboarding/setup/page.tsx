'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Stepper } from '@/components/ui/stepper'
import { useOnboardingStore } from '@/lib/stores/onboarding'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Rocket,
} from 'lucide-react'

const steps = [
  { id: 'welcome', title: 'Welcome' },
  { id: 'connect', title: 'Connect' },
  { id: 'setup', title: 'Setup' },
]

// Mock repositories - in production, fetch from GitHub API
const mockRepos = [
  { id: '1', name: 'frontend', fullName: 'acme/frontend', hasDeployments: true },
  { id: '2', name: 'backend-api', fullName: 'acme/backend-api', hasDeployments: true },
  { id: '3', name: 'infrastructure', fullName: 'acme/infrastructure', hasDeployments: false },
  { id: '4', name: 'mobile-app', fullName: 'acme/mobile-app', hasDeployments: true },
]

export default function SetupPage() {
  const router = useRouter()
  const { integrations, selectedRepos, setSelectedRepos, prevStep, reset } = useOnboardingStore()
  const [isCompleting, setIsCompleting] = useState(false)
  const [webhookCopied, setWebhookCopied] = useState(false)

  // Generate webhook URL (in production, use actual org slug)
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://sre-agent.vercel.app'}/api/webhooks/datadog?org=your-org`

  const handleRepoToggle = (repoId: string) => {
    const newRepos = selectedRepos.includes(repoId)
      ? selectedRepos.filter((id) => id !== repoId)
      : [...selectedRepos, repoId]
    setSelectedRepos(newRepos)
  }

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setWebhookCopied(true)
    toast.success('Webhook URL copied to clipboard')
    setTimeout(() => setWebhookCopied(false), 2000)
  }

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      // Save configuration to backend
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedRepos,
        }),
      })

      toast.success('Setup complete! Redirecting to dashboard...')
      reset() // Clear onboarding state
      router.push('/dashboard')
    } catch (error) {
      toast.error('Failed to complete setup')
    } finally {
      setIsCompleting(false)
    }
  }

  const handleBack = () => {
    prevStep()
    router.push('/onboarding/connect')
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Stepper steps={steps} currentStep={2} className="mb-12" />

      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Configure your first alert</h1>
        <p className="text-muted-foreground">
          Select repositories to monitor and set up the Datadog webhook.
        </p>
      </div>

      {/* Repository Selection */}
      {integrations.github && (
        <Card className="p-6 mb-6">
          <h2 className="font-semibold mb-4">Select repositories to monitor</h2>
          <div className="space-y-3">
            {mockRepos.map((repo) => (
              <div
                key={repo.id}
                className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={repo.id}
                  checked={selectedRepos.includes(repo.id)}
                  onCheckedChange={() => handleRepoToggle(repo.id)}
                />
                <Label
                  htmlFor={repo.id}
                  className="flex-1 cursor-pointer font-medium"
                >
                  {repo.fullName}
                </Label>
                {repo.hasDeployments && (
                  <span className="text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded">
                    Has deployments
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            The agent will track deployments from these repositories to correlate with incidents.
          </p>
        </Card>
      )}

      {/* Webhook Setup */}
      {integrations.datadog && (
        <Card className="p-6 mb-6">
          <h2 className="font-semibold mb-4">Set up Datadog webhook</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add this webhook URL to your Datadog monitors to trigger automatic investigations.
          </p>

          <div className="flex gap-2 mb-4">
            <Input
              value={webhookUrl}
              readOnly
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyWebhook}
            >
              {webhookCopied ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          <a
            href="https://app.datadoghq.com/monitors/manage"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            Open Datadog Monitors
            <ExternalLink className="h-3 w-3" />
          </a>
        </Card>
      )}

      {/* Quick Start Card */}
      <Card className="p-6 mb-8 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold mb-1">Ready to go!</h3>
            <p className="text-sm text-muted-foreground">
              Once you complete setup, Scout will automatically investigate any alert
              sent to the webhook. You&apos;ll receive findings in Slack within 60 seconds.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={handleComplete} disabled={isCompleting} size="lg">
          {isCompleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Completing...
            </>
          ) : (
            <>
              Complete Setup
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
