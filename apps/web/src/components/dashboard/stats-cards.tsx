'use client'

import { Card } from '@/components/ui/card'
import { Activity, Clock, ThumbsUp, Zap } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
}

function StatCard({ title, value, icon }: StatCardProps) {
  return (
    <Card className="p-4 border-border/50">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <div>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </div>
    </Card>
  )
}

interface StatsCardsProps {
  stats: {
    totalInvestigations: number
    avgResponseTime: string
    accuracy: string
    activeAlerts: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Investigations"
        value={stats.totalInvestigations}
        icon={<Activity className="h-4 w-4" />}
      />
      <StatCard
        title="Avg Response Time"
        value={stats.avgResponseTime}
        icon={<Zap className="h-4 w-4" />}
      />
      <StatCard
        title="Accuracy"
        value={stats.accuracy}
        icon={<ThumbsUp className="h-4 w-4" />}
      />
      <StatCard
        title="Active Alerts"
        value={stats.activeAlerts}
        icon={<Clock className="h-4 w-4" />}
      />
    </div>
  )
}
