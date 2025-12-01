'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

interface UsageStats {
  investigations: {
    total: number
    thisMonth: number
    lastMonth: number
  }
  toolCalls: {
    total: number
    thisMonth: number
  }
  monitoringRuns: {
    total: number
    thisMonth: number
  }
}

interface DailyUsage {
  date: string
  investigations: number
  toolCalls: number
}

export default function UsagePage() {
  const router = useRouter()
  const [stats, setStats] = useState<UsageStats | null>(null)
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchUsageData() {
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
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

        // Fetch investigations
        const { data: allInvestigations } = await supabase
          .from('investigations')
          .select('id, created_at, tool_calls')
          .eq('org_id', orgId)

        // Fetch monitoring runs
        const { data: allRuns } = await supabase
          .from('monitoring_job_runs')
          .select('id, started_at')
          .eq('org_id', orgId)

        const investigations = allInvestigations || []
        const runs = allRuns || []

        // Calculate stats
        const thisMonthInvestigations = investigations.filter(
          i => new Date(i.created_at) >= startOfMonth
        )
        const lastMonthInvestigations = investigations.filter(
          i => new Date(i.created_at) >= startOfLastMonth && new Date(i.created_at) <= endOfLastMonth
        )

        const totalToolCalls = investigations.reduce((sum, i) => sum + (i.tool_calls || 0), 0)
        const thisMonthToolCalls = thisMonthInvestigations.reduce((sum, i) => sum + (i.tool_calls || 0), 0)

        const thisMonthRuns = runs.filter(
          r => new Date(r.started_at) >= startOfMonth
        )

        setStats({
          investigations: {
            total: investigations.length,
            thisMonth: thisMonthInvestigations.length,
            lastMonth: lastMonthInvestigations.length,
          },
          toolCalls: {
            total: totalToolCalls,
            thisMonth: thisMonthToolCalls,
          },
          monitoringRuns: {
            total: runs.length,
            thisMonth: thisMonthRuns.length,
          },
        })

        // Build daily usage for last 14 days
        const daily: DailyUsage[] = []
        for (let i = 13; i >= 0; i--) {
          const date = new Date()
          date.setDate(date.getDate() - i)
          date.setHours(0, 0, 0, 0)
          const nextDate = new Date(date)
          nextDate.setDate(nextDate.getDate() + 1)

          const dayInvestigations = investigations.filter(inv => {
            const created = new Date(inv.created_at)
            return created >= date && created < nextDate
          })

          daily.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            investigations: dayInvestigations.length,
            toolCalls: dayInvestigations.reduce((sum, i) => sum + (i.tool_calls || 0), 0),
          })
        }
        setDailyUsage(daily)

      } catch (error) {
        console.error('Failed to fetch usage data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsageData()
  }, [router])

  const formatNumber = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
    return n.toString()
  }

  const getChangeIndicator = (current: number, previous: number) => {
    if (previous === 0) return null
    const change = ((current - previous) / previous) * 100
    if (change === 0) return null
    return change > 0 ? `+${change.toFixed(0)}%` : `${change.toFixed(0)}%`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">Usage</h1>
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted/30 rounded-lg" />
            ))}
          </div>
          <div className="h-48 bg-muted/30 rounded-lg" />
        </div>
      </div>
    )
  }

  const maxBarValue = Math.max(...dailyUsage.map(d => d.investigations), 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Usage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Current billing period</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-border/50">
          <p className="text-xs text-muted-foreground">Investigations</p>
          <p className="text-2xl font-semibold mt-1">{formatNumber(stats?.investigations.thisMonth || 0)}</p>
          {stats && (
            <p className="text-xs text-muted-foreground mt-1">
              {getChangeIndicator(stats.investigations.thisMonth, stats.investigations.lastMonth) || 'this month'}
            </p>
          )}
        </Card>

        <Card className="p-4 border-border/50">
          <p className="text-xs text-muted-foreground">Tool Calls</p>
          <p className="text-2xl font-semibold mt-1">{formatNumber(stats?.toolCalls.thisMonth || 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </Card>

        <Card className="p-4 border-border/50">
          <p className="text-xs text-muted-foreground">Monitoring Runs</p>
          <p className="text-2xl font-semibold mt-1">{formatNumber(stats?.monitoringRuns.thisMonth || 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">this month</p>
        </Card>
      </div>

      {/* Activity Chart */}
      <Card className="p-4 border-border/50">
        <p className="text-sm font-medium mb-4">Activity</p>
        <div className="flex items-end gap-1 h-32">
          {dailyUsage.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-primary/20 rounded-sm hover:bg-primary/30 transition-colors"
                style={{
                  height: `${Math.max((day.investigations / maxBarValue) * 100, 4)}%`,
                  minHeight: day.investigations > 0 ? '8px' : '2px',
                }}
                title={`${day.investigations} investigations`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">{dailyUsage[0]?.date}</span>
          <span className="text-[10px] text-muted-foreground">{dailyUsage[dailyUsage.length - 1]?.date}</span>
        </div>
      </Card>

      {/* Totals */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">All time</p>
        <div className="flex gap-6 text-sm">
          <span>
            <span className="text-muted-foreground">Investigations:</span>{' '}
            <span className="font-medium">{stats?.investigations.total || 0}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Tool calls:</span>{' '}
            <span className="font-medium">{formatNumber(stats?.toolCalls.total || 0)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Monitoring runs:</span>{' '}
            <span className="font-medium">{stats?.monitoringRuns.total || 0}</span>
          </span>
        </div>
      </div>
    </div>
  )
}

