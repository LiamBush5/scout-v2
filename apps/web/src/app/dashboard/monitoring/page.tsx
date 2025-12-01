'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Clock,
    Play,
    Pause,
    Plus,
    Trash2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    GitBranch,
    Activity,
    AlertTriangle,
    BarChart3,
    Settings,
    ChevronDown,
    ChevronRight,
    Info,
} from 'lucide-react'

interface Finding {
    type: 'info' | 'warning' | 'error' | 'success'
    title: string
    description?: string
    metric?: string
    value?: string | number
}

interface MonitoringJob {
    id: string
    name: string
    description: string | null
    job_type: 'deployment_watcher' | 'health_check' | 'error_scanner' | 'baseline_builder' | 'custom'
    schedule_interval: number
    enabled: boolean
    config: Record<string, unknown>
    notify_on: 'always' | 'issues' | 'never'
    last_run_at: string | null
    next_run_at: string | null
    consecutive_failures: number
    created_at: string
    latest_run: {
        id: string
        status: 'running' | 'completed' | 'failed'
        summary: string | null
        findings: Finding[] | null
        error_message: string | null
        alert_sent: boolean
        alert_severity: 'info' | 'warning' | 'critical' | null
        started_at: string
        completed_at: string | null
        duration_ms: number | null
    } | null
}

const JOB_TYPE_INFO = {
    deployment_watcher: {
        label: 'Deployment Watcher',
        description: 'Monitor for new deployments and detect regressions',
        icon: GitBranch,
        color: 'text-blue-500',
    },
    health_check: {
        label: 'Health Check',
        description: 'Check service health metrics and error rates',
        icon: Activity,
        color: 'text-green-500',
    },
    error_scanner: {
        label: 'Error Scanner',
        description: 'Scan logs for new error patterns',
        icon: AlertTriangle,
        color: 'text-yellow-500',
    },
    baseline_builder: {
        label: 'Baseline Builder',
        description: 'Collect metrics to build service baselines',
        icon: BarChart3,
        color: 'text-purple-500',
    },
    custom: {
        label: 'Custom',
        description: 'Run a custom monitoring query',
        icon: Settings,
        color: 'text-gray-500',
    },
}

export default function MonitoringPage() {
    const [jobs, setJobs] = useState<MonitoringJob[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set())
    const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set())

    // Form state for new job
    const [newJob, setNewJob] = useState({
        name: '',
        description: '',
        job_type: 'deployment_watcher' as const,
        schedule_interval: 15,
        notify_on: 'issues' as const,
    })

    const fetchJobs = useCallback(async () => {
        try {
            const response = await fetch('/api/monitoring-jobs')
            if (response.ok) {
                const data = await response.json()
                setJobs(data.jobs || [])
            }
        } catch (error) {
            console.error('Failed to fetch jobs:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchJobs()
        // Refresh every 30 seconds
        const interval = setInterval(fetchJobs, 30000)
        return () => clearInterval(interval)
    }, [fetchJobs])

    const createJob = async () => {
        setIsCreating(true)
        try {
            const response = await fetch('/api/monitoring-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJob),
            })
            if (response.ok) {
                setShowCreateDialog(false)
                setNewJob({
                    name: '',
                    description: '',
                    job_type: 'deployment_watcher',
                    schedule_interval: 15,
                    notify_on: 'issues',
                })
                fetchJobs()
            }
        } catch (error) {
            console.error('Failed to create job:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const toggleJob = async (job: MonitoringJob) => {
        try {
            const response = await fetch(`/api/monitoring-jobs/${job.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !job.enabled }),
            })
            if (response.ok) {
                fetchJobs()
            }
        } catch (error) {
            console.error('Failed to toggle job:', error)
        }
    }

    const deleteJob = async (jobId: string) => {
        if (!confirm('Are you sure you want to delete this job?')) return
        try {
            const response = await fetch(`/api/monitoring-jobs/${jobId}`, {
                method: 'DELETE',
            })
            if (response.ok) {
                fetchJobs()
            }
        } catch (error) {
            console.error('Failed to delete job:', error)
        }
    }

    const runJob = async (jobId: string) => {
        setRunningJobs(prev => new Set(prev).add(jobId))
        try {
            const response = await fetch(`/api/monitoring-jobs/${jobId}/run`, {
                method: 'POST',
            })
            if (response.ok) {
                // Refresh after a short delay to show the running status
                setTimeout(fetchJobs, 1000)
            }
        } catch (error) {
            console.error('Failed to run job:', error)
        } finally {
            setTimeout(() => {
                setRunningJobs(prev => {
                    const next = new Set(prev)
                    next.delete(jobId)
                    return next
                })
            }, 2000)
        }
    }

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
        return `${(ms / 60000).toFixed(1)}m`
    }

    const formatInterval = (minutes: number) => {
        if (minutes < 60) return `Every ${minutes}min`
        if (minutes === 60) return 'Hourly'
        if (minutes < 1440) return `Every ${minutes / 60}h`
        return 'Daily'
    }

    const getStatusIcon = (job: MonitoringJob) => {
        if (!job.latest_run) return <Clock className="h-4 w-4 text-muted-foreground" />
        if (job.latest_run.status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        if (job.latest_run.status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />
        if (job.latest_run.status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }

    const getTimeAgo = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)

        if (diffMins < 1) return 'just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffHours < 24) return `${diffHours}h ago`
        return `${diffDays}d ago`
    }

    const toggleJobExpanded = (jobId: string) => {
        setExpandedJobs(prev => {
            const next = new Set(prev)
            if (next.has(jobId)) {
                next.delete(jobId)
            } else {
                next.add(jobId)
            }
            return next
        })
    }

    const getFindingIcon = (type: Finding['type']) => {
        switch (type) {
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />
            case 'warning':
                return <AlertTriangle className="h-4 w-4 text-yellow-500" />
            case 'success':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />
            default:
                return <Info className="h-4 w-4 text-blue-500" />
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Scheduled Monitoring</h1>
                    <p className="text-muted-foreground">
                        Configure automated monitoring jobs that run on a schedule
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchJobs}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                New Job
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Create Monitoring Job</DialogTitle>
                                <DialogDescription>
                                    Set up a new scheduled monitoring job
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="e.g., API Health Check"
                                        value={newJob.name}
                                        onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description">Description (optional)</Label>
                                    <Input
                                        id="description"
                                        placeholder="What does this job monitor?"
                                        value={newJob.description}
                                        onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Job Type</Label>
                                    <Select
                                        value={newJob.job_type}
                                        onValueChange={(value) => setNewJob({ ...newJob, job_type: value as typeof newJob.job_type })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(JOB_TYPE_INFO).map(([key, info]) => (
                                                <SelectItem key={key} value={key}>
                                                    <div className="flex items-center gap-2">
                                                        <info.icon className={`h-4 w-4 ${info.color}`} />
                                                        <span>{info.label}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        {JOB_TYPE_INFO[newJob.job_type].description}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label>Schedule</Label>
                                    <Select
                                        value={newJob.schedule_interval.toString()}
                                        onValueChange={(value) => setNewJob({ ...newJob, schedule_interval: parseInt(value) })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">Every 5 minutes</SelectItem>
                                            <SelectItem value="10">Every 10 minutes</SelectItem>
                                            <SelectItem value="15">Every 15 minutes</SelectItem>
                                            <SelectItem value="30">Every 30 minutes</SelectItem>
                                            <SelectItem value="60">Hourly</SelectItem>
                                            <SelectItem value="360">Every 6 hours</SelectItem>
                                            <SelectItem value="1440">Daily</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Notify</Label>
                                    <Select
                                        value={newJob.notify_on}
                                        onValueChange={(value) => setNewJob({ ...newJob, notify_on: value as typeof newJob.notify_on })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="issues">Only when issues found</SelectItem>
                                            <SelectItem value="always">Always (every run)</SelectItem>
                                            <SelectItem value="never">Never (log only)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={createJob} disabled={!newJob.name || isCreating}>
                                    {isCreating ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Create Job
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {jobs.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No monitoring jobs</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-4">
                            Create scheduled jobs to automatically monitor your services for deployments,
                            errors, and health issues.
                        </p>
                        <Button onClick={() => setShowCreateDialog(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create your first job
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {jobs.map((job) => {
                        const typeInfo = JOB_TYPE_INFO[job.job_type]
                        const TypeIcon = typeInfo.icon
                        const isRunning = runningJobs.has(job.id) || job.latest_run?.status === 'running'

                        return (
                            <Card key={job.id} className={!job.enabled ? 'opacity-60' : ''}>
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-2 rounded-lg bg-muted ${typeInfo.color}`}>
                                                <TypeIcon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    {job.name}
                                                    {!job.enabled && (
                                                        <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                            Paused
                                                        </span>
                                                    )}
                                                    {job.consecutive_failures > 2 && (
                                                        <span className="text-xs font-normal text-red-500 bg-red-500/10 px-2 py-0.5 rounded flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" />
                                                            {job.consecutive_failures} failures
                                                        </span>
                                                    )}
                                                </CardTitle>
                                                <CardDescription className="mt-1">
                                                    {job.description || typeInfo.description}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => runJob(job.id)}
                                                disabled={isRunning}
                                                title="Run now"
                                            >
                                                {isRunning ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Play className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => toggleJob(job)}
                                                title={job.enabled ? 'Pause' : 'Enable'}
                                            >
                                                {job.enabled ? (
                                                    <Pause className="h-4 w-4" />
                                                ) : (
                                                    <Play className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => deleteJob(job.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Clock className="h-4 w-4" />
                                            <span>{formatInterval(job.schedule_interval)}</span>
                                        </div>
                                        {job.latest_run && (
                                            <>
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(job)}
                                                    <span className="text-muted-foreground">
                                                        {job.latest_run.status === 'running' ? 'Running...' :
                                                         job.latest_run.started_at ? getTimeAgo(job.latest_run.started_at) : 'Never'}
                                                    </span>
                                                </div>
                                                {job.latest_run.duration_ms && (
                                                    <div className="text-muted-foreground">
                                                        {formatDuration(job.latest_run.duration_ms)}
                                                    </div>
                                                )}
                                                {job.latest_run.alert_sent && (
                                                    <div className="flex items-center gap-1 text-yellow-500">
                                                        <AlertTriangle className="h-4 w-4" />
                                                        <span className="text-xs">Alert sent</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {job.next_run_at && job.enabled && (
                                            <div className="text-muted-foreground ml-auto text-xs">
                                                Next: {getTimeAgo(job.next_run_at).replace(' ago', '')}
                                            </div>
                                        )}
                                    </div>

                                    {/* Latest Run Results */}
                                    {job.latest_run && (job.latest_run.summary || job.latest_run.findings?.length || job.latest_run.error_message) && (
                                        <div className="mt-3">
                                            <button
                                                onClick={() => toggleJobExpanded(job.id)}
                                                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                                            >
                                                {expandedJobs.has(job.id) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                                <span className="font-medium">
                                                    {job.latest_run.status === 'failed' ? 'Error Details' : 'Latest Results'}
                                                </span>
                                                {job.latest_run.findings && job.latest_run.findings.length > 0 && (
                                                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                                                        {job.latest_run.findings.length} finding{job.latest_run.findings.length !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </button>

                                            {expandedJobs.has(job.id) && (
                                                <div className="mt-3 space-y-3">
                                                    {/* Error message if failed */}
                                                    {job.latest_run.error_message && (
                                                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                                            <div className="flex items-start gap-2">
                                                                <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                                                                <div className="text-sm text-red-400">
                                                                    {job.latest_run.error_message}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Summary */}
                                                    {job.latest_run.summary && (
                                                        <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
                                                            {job.latest_run.summary}
                                                        </div>
                                                    )}

                                                    {/* Findings */}
                                                    {job.latest_run.findings && job.latest_run.findings.length > 0 && (
                                                        <div className="space-y-2">
                                                            {job.latest_run.findings.map((finding, index) => (
                                                                <div
                                                                    key={index}
                                                                    className={`rounded-lg p-3 border ${
                                                                        finding.type === 'error' ? 'bg-red-500/5 border-red-500/20' :
                                                                        finding.type === 'warning' ? 'bg-yellow-500/5 border-yellow-500/20' :
                                                                        finding.type === 'success' ? 'bg-green-500/5 border-green-500/20' :
                                                                        'bg-blue-500/5 border-blue-500/20'
                                                                    }`}
                                                                >
                                                                    <div className="flex items-start gap-2">
                                                                        {getFindingIcon(finding.type)}
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <span className="text-sm font-medium">
                                                                                    {finding.title}
                                                                                </span>
                                                                                {finding.metric && finding.value !== undefined && (
                                                                                    <span className="text-xs font-mono bg-background/50 px-2 py-0.5 rounded">
                                                                                        {finding.metric}: {finding.value}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            {finding.description && (
                                                                                <p className="text-sm text-muted-foreground mt-1">
                                                                                    {finding.description}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* No findings message */}
                                                    {!job.latest_run.findings?.length && !job.latest_run.summary && !job.latest_run.error_message && (
                                                        <div className="text-sm text-muted-foreground italic">
                                                            No details available for this run.
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Info card about cron */}
            <Card className="bg-muted/30">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">How it works</p>
                            <p>
                                Jobs run automatically on their schedule. The cron system checks every 5 minutes
                                for jobs that need to run. Results are stored and alerts are sent to Slack based
                                on your notification settings.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
