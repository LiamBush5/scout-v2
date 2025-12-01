'use client'

import { useState, useEffect } from 'react'
import { InvestigationCard } from '@/components/dashboard/investigation-card'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Filter } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Investigation {
  id: string
  title: string
  service: string
  status: 'completed' | 'running' | 'failed' | 'queued'
  confidence?: number
  summary?: string
  createdAt: string
  durationMs?: number
  feedback?: 'helpful' | 'not_helpful' | null
}

export default function InvestigationsPage() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchInvestigations() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      // Get user's current org
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_org_id')
        .eq('id', user.id)
        .single()

      if (!profile?.current_org_id) {
        setLoading(false)
        return
      }

      // Fetch investigations
      const { data } = await supabase
        .from('investigations')
        .select('*')
        .eq('org_id', profile.current_org_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) {
        setInvestigations(data.map(inv => ({
          id: inv.id,
          title: inv.alert_name || inv.monitor_name || 'Investigation',
          service: inv.service || 'Unknown',
          status: inv.status as Investigation['status'],
          confidence: inv.confidence_score || undefined,
          summary: inv.summary || undefined,
          createdAt: inv.created_at,
          durationMs: inv.duration_ms || undefined,
          feedback: inv.feedback_rating as Investigation['feedback'],
        })))
      }

      setLoading(false)
    }

    fetchInvestigations()

    // Set up realtime subscription
    const supabase = createClient()
    const channel = supabase
      .channel('investigations-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investigations' },
        () => {
          // Refetch on any change
          fetchInvestigations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const filteredInvestigations = investigations.filter((inv) => {
    const matchesSearch =
      inv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.service.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus =
      statusFilter === 'all' || inv.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Investigations</h1>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : filteredInvestigations.length > 0 ? (
        <div className="space-y-2">
          {filteredInvestigations.map((investigation) => (
            <InvestigationCard
              key={investigation.id}
              investigation={investigation}
            />
          ))}
        </div>
      ) : investigations.length === 0 ? (
        <Card className="p-8 text-center border-border/50">
          <p className="text-sm text-muted-foreground">No investigations yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Investigations will appear here when alerts are received via the Datadog webhook.
          </p>
        </Card>
      ) : (
        <Card className="p-8 text-center border-border/50">
          <p className="text-sm text-muted-foreground">No investigations match your filters</p>
        </Card>
      )}
    </div>
  )
}
