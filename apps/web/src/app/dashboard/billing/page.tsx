'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PlanDetails {
  name: 'free' | 'pro' | 'enterprise'
  investigationsLimit: number | null // null = unlimited (enterprise)
  investigationsUsed: number
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: null,
    description: 'For trying out Scout',
    investigationsLimit: 20,
    features: [
      '20 investigations / month',
      'Datadog integration',
      'Basic runbooks',
      'Community support',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    interval: 'month',
    description: 'For growing teams',
    investigationsLimit: 500,
    popular: true,
    features: [
      '500 investigations / month',
      'All integrations',
      'Custom runbooks',
      'Slack notifications',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: null,
    interval: null,
    description: 'For large organizations',
    investigationsLimit: null,
    features: [
      'Unlimited investigations',
      'SSO / SAML',
      'Dedicated support',
      'Custom SLAs',
      'On-premise option',
    ],
  },
]

export default function BillingPage() {
  const router = useRouter()
  const [plan, setPlan] = useState<PlanDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)
  const [isManaging, setIsManaging] = useState(false)

  useEffect(() => {
    async function fetchBillingData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          router.push('/login')
          return
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('current_org_id')
          .eq('id', user.id)
          .single()

        if (!profileData?.current_org_id) {
          setIsLoading(false)
          return
        }

        const orgId = profileData.current_org_id

        // Fetch org billing info
        const { data: orgData } = await supabase
          .from('organizations')
          .select('plan, investigations_limit, plan_period_end, plan_cancel_at_period_end')
          .eq('id', orgId)
          .single()

        // Get investigation count for current month (UTC-based)
        const now = new Date()
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

        const { count } = await supabase
          .from('investigations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', orgId)
          .gte('created_at', startOfMonth.toISOString())

        // investigations_limit is null for enterprise (unlimited)
        const limit = orgData?.investigations_limit

        setPlan({
          name: (orgData?.plan || 'free') as 'free' | 'pro' | 'enterprise',
          investigationsLimit: limit,
          investigationsUsed: count || 0,
          currentPeriodEnd: orgData?.plan_period_end || null,
          cancelAtPeriodEnd: orgData?.plan_cancel_at_period_end || false,
        })

      } catch (error) {
        console.error('Failed to fetch billing data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBillingData()
  }, [router])

  const handleUpgrade = async (planId: string) => {
    setIsUpgrading(planId)
    try {
      // TODO: Integrate with Stripe checkout
      // const res = await fetch('/api/billing/checkout', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ planId }),
      // })
      // const { url } = await res.json()
      // window.location.href = url

      toast.info('Stripe integration coming soon')
    } catch (error) {
      console.error('Failed to start checkout:', error)
      toast.error('Failed to start checkout')
    } finally {
      setIsUpgrading(null)
    }
  }

  const handleManageBilling = async () => {
    setIsManaging(true)
    try {
      // TODO: Redirect to Stripe customer portal
      // const res = await fetch('/api/billing/portal', { method: 'POST' })
      // const { url } = await res.json()
      // window.location.href = url

      toast.info('Billing portal coming soon')
    } catch (error) {
      console.error('Failed to open billing portal:', error)
      toast.error('Failed to open billing portal')
    } finally {
      setIsManaging(false)
    }
  }

  const handleContactSales = () => {
    window.location.href = 'mailto:sales@scout.dev?subject=Enterprise%20Plan%20Inquiry'
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Billing</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted/30 rounded-lg" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted/30 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  const currentPlan = plans.find(p => p.id === plan?.name) || plans[0]
  const usagePercent = plan?.investigationsLimit
    ? Math.min((plan.investigationsUsed / plan.investigationsLimit) * 100, 100)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan */}
      <Card className="p-4 border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold mt-0.5 capitalize">{plan?.name}</p>
            {plan?.name !== 'free' && plan?.currentPeriodEnd && (
              <p className="text-xs text-muted-foreground mt-1">
                {plan.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} {new Date(plan.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
          {plan?.name !== 'free' && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleManageBilling}
              disabled={isManaging}
            >
              {isManaging && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Manage
            </Button>
          )}
        </div>

        {/* Usage bar */}
        <div className="mt-4 pt-4 border-t border-border/40">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Investigations this month</span>
            <span>
              <span className="font-medium">{plan?.investigationsUsed || 0}</span>
              {plan?.investigationsLimit ? (
                <span className="text-muted-foreground"> / {plan.investigationsLimit}</span>
              ) : (
                <span className="text-muted-foreground"> / unlimited</span>
              )}
            </span>
          </div>
          {plan?.investigationsLimit && (
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePercent >= 90 ? "bg-destructive" : usagePercent >= 70 ? "bg-amber-500" : "bg-primary"
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Plans */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Plans</p>
        <div className="grid grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = p.id === plan?.name
            const isDowngrade = plans.findIndex(x => x.id === p.id) < plans.findIndex(x => x.id === plan?.name)

            return (
              <Card
                key={p.id}
                className={cn(
                  "p-4 border-border/50 flex flex-col",
                  p.popular && "ring-1 ring-primary/50"
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium">{p.name}</p>
                  {p.popular && (
                    <span className="text-[10px] text-primary font-medium">Popular</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{p.description}</p>

                <div className="mt-3 mb-4">
                  {p.price === null ? (
                    <span className="text-2xl font-semibold">Custom</span>
                  ) : p.price === 0 ? (
                    <span className="text-2xl font-semibold">$0</span>
                  ) : (
                    <>
                      <span className="text-2xl font-semibold">${p.price}</span>
                      <span className="text-xs text-muted-foreground">/{p.interval}</span>
                    </>
                  )}
                </div>

                <ul className="space-y-2 flex-1 mb-4">
                  {p.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" size="sm" className="h-8 text-xs w-full" disabled>
                    Current plan
                  </Button>
                ) : p.id === 'enterprise' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs w-full"
                    onClick={handleContactSales}
                  >
                    Contact sales
                  </Button>
                ) : isDowngrade ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs w-full"
                    onClick={() => handleUpgrade(p.id)}
                    disabled={!!isUpgrading}
                  >
                    Downgrade
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 text-xs w-full"
                    onClick={() => handleUpgrade(p.id)}
                    disabled={!!isUpgrading}
                  >
                    {isUpgrading === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Upgrade
                  </Button>
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {/* FAQ / Info */}
      <div className="space-y-3 text-xs text-muted-foreground">
        <p>
          All plans include unlimited team members and basic integrations.
          Need more? <button onClick={handleContactSales} className="text-foreground hover:underline">Contact us</button>.
        </p>
      </div>
    </div>
  )
}

