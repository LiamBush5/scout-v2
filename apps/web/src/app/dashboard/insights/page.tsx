'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    TrendingUp,
    TrendingDown,
    Minus,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    Clock,
    Loader2,
    Brain,
    BarChart3,
    Target,
    Lightbulb,
    ArrowRight,
} from 'lucide-react'

interface ServiceHealth {
    service: string
    total_incidents: number
    incidents_this_week: number
    incidents_last_week: number
    trend: 'worsening' | 'improving' | 'stable'
    avg_confidence: number | null
    helpful_rate: number | null
    top_root_cause: string | null
    top_root_cause_count: number | null
    last_incident_at: string
    avg_resolution_time_ms: number | null
}

interface AlertEffectiveness {
    alert_name: string
    monitor_id: string | null
    total_triggers: number
    completed: number
    helpful: number
    not_helpful: number
    no_feedback: number
    helpful_rate: number | null
    avg_confidence: number | null
    avg_resolution_time_ms: number | null
    effectiveness_score: number
}

interface RootCausePattern {
    category: string
    pattern_count: number
    percentage: number
    avg_confidence: number | null
    example_root_cause: string | null
    affected_services: string[]
}

interface Summary {
    total_investigations: number
    completed: number
    completion_rate: number
    helpful_rate: number | null
    avg_confidence: number | null
    avg_resolution_time_ms: number | null
    days_analyzed: number
}

const TREND_CONFIG = {
    worsening: { icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-500/10', label: 'More incidents' },
    improving: { icon: TrendingDown, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Fewer incidents' },
    stable: { icon: Minus, color: 'text-gray-500', bg: 'bg-gray-500/10', label: 'Stable' },
}

const CATEGORY_COLORS: Record<string, string> = {
    'Deployment': 'bg-blue-500',
    'Database': 'bg-purple-500',
    'Resource Exhaustion': 'bg-red-500',
    'Performance': 'bg-yellow-500',
    'Configuration': 'bg-orange-500',
    'External Dependency': 'bg-pink-500',
    'Traffic/Scale': 'bg-cyan-500',
    'Other': 'bg-gray-500',
}

function formatDuration(ms: number | null): string {
    if (!ms) return '-'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
}

function formatPercentage(value: number | null): string {
    if (value === null) return '-'
    return `${Math.round(value * 100)}%`
}

export default function InsightsPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [daysBack, setDaysBack] = useState('30')
    const [summary, setSummary] = useState<Summary | null>(null)
    const [serviceHealth, setServiceHealth] = useState<ServiceHealth[]>([])
    const [alertEffectiveness, setAlertEffectiveness] = useState<AlertEffectiveness[]>([])
    const [rootCausePatterns, setRootCausePatterns] = useState<RootCausePattern[]>([])

    const fetchInsights = useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/insights?days_back=${daysBack}`)
            if (response.ok) {
                const data = await response.json()
                setSummary(data.summary)
                setServiceHealth(data.service_health || [])
                setAlertEffectiveness(data.alert_effectiveness || [])
                setRootCausePatterns(data.root_cause_patterns || [])
            }
        } catch (error) {
            console.error('Failed to fetch insights:', error)
        } finally {
            setIsLoading(false)
        }
    }, [daysBack])

    useEffect(() => {
        fetchInsights()
    }, [fetchInsights])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Analyzing your incidents...</span>
                </div>
            </div>
        )
    }

    const noData = !summary || summary.total_investigations === 0

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Brain className="h-6 w-6" />
                        Insights
                    </h1>
                    <p className="text-muted-foreground">
                        Patterns and learnings from your investigations
                    </p>
                </div>
                <Select value={daysBack} onValueChange={setDaysBack}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {noData ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No insights yet</h3>
                        <p className="text-muted-foreground text-center max-w-md">
                            Insights are generated from your investigations. Once you have some completed
                            investigations, you&apos;ll see patterns, trends, and recommendations here.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Summary Stats */}
                    <div className="grid gap-4 md:grid-cols-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Total Investigations</CardDescription>
                                <CardTitle className="text-3xl">{summary?.total_investigations}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    {summary?.completed} completed ({summary?.completion_rate}%)
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Helpful Rate</CardDescription>
                                <CardTitle className="text-3xl">
                                    {summary?.helpful_rate !== null ? `${summary.helpful_rate}%` : '-'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Based on user feedback
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Avg Confidence</CardDescription>
                                <CardTitle className="text-3xl">
                                    {summary?.avg_confidence !== null ? `${summary.avg_confidence}%` : '-'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Root cause identification
                                </p>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardDescription>Avg Resolution Time</CardDescription>
                                <CardTitle className="text-3xl">
                                    {formatDuration(summary?.avg_resolution_time_ms || null)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-xs text-muted-foreground">
                                    Time to complete investigation
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Root Cause Patterns */}
                    {rootCausePatterns.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5" />
                                    Root Cause Distribution
                                </CardTitle>
                                <CardDescription>
                                    What&apos;s causing your incidents
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {rootCausePatterns.map((pattern) => (
                                        <div key={pattern.category} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full ${CATEGORY_COLORS[pattern.category] || 'bg-gray-500'}`} />
                                                    <span className="font-medium">{pattern.category}</span>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {pattern.pattern_count} incidents
                                                    </Badge>
                                                </div>
                                                <span className="text-sm text-muted-foreground">
                                                    {Math.round(pattern.percentage)}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-2">
                                                <div
                                                    className={`h-2 rounded-full ${CATEGORY_COLORS[pattern.category] || 'bg-gray-500'}`}
                                                    style={{ width: `${pattern.percentage}%` }}
                                                />
                                            </div>
                                            {pattern.affected_services.length > 0 && (
                                                <p className="text-xs text-muted-foreground">
                                                    Affects: {pattern.affected_services.slice(0, 3).join(', ')}
                                                    {pattern.affected_services.length > 3 && ` +${pattern.affected_services.length - 3} more`}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Insight callout */}
                                {rootCausePatterns[0] && (
                                    <div className="mt-6 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
                                        <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                                        <div>
                                            <p className="font-medium">Key Insight</p>
                                            <p className="text-sm text-muted-foreground">
                                                <strong>{Math.round(rootCausePatterns[0].percentage)}%</strong> of your incidents are caused by{' '}
                                                <strong>{rootCausePatterns[0].category.toLowerCase()}</strong> issues.
                                                {rootCausePatterns[0].category === 'Deployment' && (
                                                    <> Consider adding more deployment checks to your runbooks.</>
                                                )}
                                                {rootCausePatterns[0].category === 'Database' && (
                                                    <> Review your database monitoring and connection pool settings.</>
                                                )}
                                                {rootCausePatterns[0].category === 'Resource Exhaustion' && (
                                                    <> Consider setting up autoscaling or resource alerts.</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Service Health */}
                    {serviceHealth.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Target className="h-5 w-5" />
                                    Service Health
                                </CardTitle>
                                <CardDescription>
                                    Incident patterns by service
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {serviceHealth.map((service) => {
                                        const trend = TREND_CONFIG[service.trend]
                                        const TrendIcon = trend.icon

                                        return (
                                            <div key={service.service} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                                                <div className="flex items-center gap-4">
                                                    <div>
                                                        <p className="font-medium">{service.service}</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            {service.total_incidents} incidents
                                                            {service.top_root_cause && (
                                                                <> · Most common: {service.top_root_cause.slice(0, 40)}...</>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-sm">
                                                                {service.incidents_this_week} this week
                                                            </span>
                                                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                                            <span className="text-sm text-muted-foreground">
                                                                {service.incidents_last_week} last week
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Avg resolution: {formatDuration(service.avg_resolution_time_ms)}
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline" className={`${trend.bg} ${trend.color} border-0`}>
                                                        <TrendIcon className="h-3 w-3 mr-1" />
                                                        {trend.label}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Alert Effectiveness */}
                    {alertEffectiveness.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Alert Effectiveness
                                </CardTitle>
                                <CardDescription>
                                    Which alerts lead to valuable investigations vs noise
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {alertEffectiveness.slice(0, 10).map((alert) => {
                                        const isLowEffectiveness = alert.effectiveness_score < 0.5
                                        const isHighNoise = alert.not_helpful > alert.helpful

                                        return (
                                            <div
                                                key={alert.alert_name}
                                                className={`flex items-center justify-between p-3 rounded-lg ${
                                                    isLowEffectiveness ? 'bg-red-500/5 border border-red-500/20' : 'bg-muted/30'
                                                }`}
                                            >
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm">{alert.alert_name}</p>
                                                        {isHighNoise && (
                                                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-0">
                                                                High noise
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                        Triggered {alert.total_triggers} times
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-6">
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <span className="flex items-center gap-1 text-green-600">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            {alert.helpful}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-red-500">
                                                            <XCircle className="h-3 w-3" />
                                                            {alert.not_helpful}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-muted-foreground">
                                                            <Clock className="h-3 w-3" />
                                                            {alert.no_feedback}
                                                        </span>
                                                    </div>
                                                    <div className="w-24 text-right">
                                                        <p className={`text-sm font-medium ${
                                                            isLowEffectiveness ? 'text-red-500' : 'text-green-600'
                                                        }`}>
                                                            {Math.round(alert.effectiveness_score * 100)}%
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">effectiveness</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>

                                {alertEffectiveness.some(a => a.effectiveness_score < 0.5) && (
                                    <div className="mt-4 p-4 bg-muted/50 rounded-lg flex items-start gap-3">
                                        <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                                        <div>
                                            <p className="font-medium">Recommendation</p>
                                            <p className="text-sm text-muted-foreground">
                                                Some alerts have low effectiveness scores. Consider reviewing their
                                                thresholds in Datadog to reduce false positives.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </>
            )}
        </div>
    )
}
