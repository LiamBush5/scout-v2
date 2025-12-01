'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    BookOpen,
    Plus,
    Trash2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Loader2,
    AlertTriangle,
    Zap,
    Play,
    Pause,
    ChevronRight,
    Lightbulb,
    Copy,
    Sparkles,
} from 'lucide-react'

interface InvestigationStep {
    action: string
    params: Record<string, unknown>
    reason?: string
}

interface Runbook {
    id: string
    name: string
    description: string | null
    trigger_type: 'alert_pattern' | 'service_alert' | 'manual'
    trigger_config: Record<string, unknown>
    investigation_steps: InvestigationStep[]
    if_found_actions: Record<string, string>
    enabled: boolean
    priority: number
    times_triggered: number
    times_matched: number
    last_triggered_at: string | null
    avg_resolution_confidence: number | null
    created_at: string
    latest_execution: {
        id: string
        status: 'running' | 'completed' | 'failed' | 'skipped'
        conclusion: string | null
        confidence_score: number | null
        matched_condition: string | null
        user_feedback: string | null
        started_at: string
        completed_at: string | null
        duration_ms: number | null
    } | null
    success_rate: number | null
    total_executions: number
}

interface RunbookTemplate {
    id: string
    name: string
    description: string
    trigger_type: 'alert_pattern' | 'service_alert' | 'manual'
    trigger_config: Record<string, unknown>
    investigation_steps: InvestigationStep[]
    if_found_actions: Record<string, string>
}

const TRIGGER_TYPE_INFO = {
    alert_pattern: {
        label: 'Alert Pattern',
        description: 'Triggers when alert name matches a pattern',
        icon: Zap,
        color: 'text-yellow-500',
    },
    service_alert: {
        label: 'Service Alert',
        description: 'Triggers for any alert on specific services',
        icon: AlertTriangle,
        color: 'text-blue-500',
    },
    manual: {
        label: 'Manual',
        description: 'Only runs when manually invoked',
        icon: Play,
        color: 'text-gray-500',
    },
}

const AVAILABLE_ACTIONS = [
    { value: 'check_deployments', label: 'Check Recent Deployments', description: 'Look for deployments in the last N hours' },
    { value: 'check_downstream_health', label: 'Check Downstream Health', description: 'Verify dependencies are healthy' },
    { value: 'check_db_connections', label: 'Check DB Connections', description: 'Monitor database connection pool' },
    { value: 'check_cache_hit_rate', label: 'Check Cache Hit Rate', description: 'Verify cache is working effectively' },
    { value: 'check_traffic_volume', label: 'Check Traffic Volume', description: 'Compare current traffic to baseline' },
    { value: 'check_error_rate', label: 'Check Error Rate', description: 'Monitor service error rates' },
    { value: 'check_latency', label: 'Check Latency', description: 'Monitor p50/p95/p99 latency' },
    { value: 'check_resource_usage', label: 'Check Resource Usage', description: 'Monitor CPU and memory' },
    { value: 'search_error_logs', label: 'Search Error Logs', description: 'Find error patterns in logs' },
    { value: 'check_similar_incidents', label: 'Check Similar Incidents', description: 'Find past incidents with similar symptoms' },
    { value: 'check_memory_trend', label: 'Check Memory Trend', description: 'Analyze memory usage over time' },
    { value: 'check_slow_queries', label: 'Check Slow Queries', description: 'Find slow database queries' },
    { value: 'check_db_replication_lag', label: 'Check Replication Lag', description: 'Monitor DB replication delay' },
]

type TriggerType = 'alert_pattern' | 'service_alert' | 'manual'

interface NewRunbookForm {
    name: string
    description: string
    trigger_type: TriggerType
    trigger_config: Record<string, unknown>
    investigation_steps: InvestigationStep[]
    if_found_actions: Record<string, string>
    enabled: boolean
    priority: number
}

const DEFAULT_RUNBOOK_FORM: NewRunbookForm = {
    name: '',
    description: '',
    trigger_type: 'alert_pattern',
    trigger_config: { pattern: '', severity: ['critical', 'high'] },
    investigation_steps: [{ action: 'check_deployments', params: { hours_back: 2 }, reason: '' }],
    if_found_actions: {},
    enabled: true,
    priority: 100,
}

export default function RunbooksPage() {
    const [runbooks, setRunbooks] = useState<Runbook[]>([])
    const [templates, setTemplates] = useState<RunbookTemplate[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [showTemplateDialog, setShowTemplateDialog] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<RunbookTemplate | null>(null)
    const [activeTab, setActiveTab] = useState('runbooks')

    // Form state for new runbook
    const [newRunbook, setNewRunbook] = useState<NewRunbookForm>(DEFAULT_RUNBOOK_FORM)

    const fetchRunbooks = useCallback(async () => {
        try {
            const response = await fetch('/api/runbooks')
            if (response.ok) {
                const data = await response.json()
                setRunbooks(data.runbooks || [])
            }
        } catch (error) {
            console.error('Failed to fetch runbooks:', error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    const fetchTemplates = useCallback(async () => {
        try {
            const response = await fetch('/api/runbooks/templates')
            if (response.ok) {
                const data = await response.json()
                setTemplates(data.templates || [])
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error)
        }
    }, [])

    useEffect(() => {
        fetchRunbooks()
        fetchTemplates()
    }, [fetchRunbooks, fetchTemplates])

    const createRunbook = async () => {
        setIsCreating(true)
        try {
            const response = await fetch('/api/runbooks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRunbook),
            })
            if (response.ok) {
                setShowCreateDialog(false)
                resetForm()
                fetchRunbooks()
            }
        } catch (error) {
            console.error('Failed to create runbook:', error)
        } finally {
            setIsCreating(false)
        }
    }

    const createFromTemplate = async (template: RunbookTemplate) => {
        setNewRunbook({
            name: template.name,
            description: template.description,
            trigger_type: template.trigger_type,
            trigger_config: template.trigger_config,
            investigation_steps: template.investigation_steps,
            if_found_actions: template.if_found_actions,
            enabled: true,
            priority: 100,
        })
        setShowTemplateDialog(false)
        setShowCreateDialog(true)
    }

    const resetForm = () => {
        setNewRunbook({ ...DEFAULT_RUNBOOK_FORM })
    }

    const toggleRunbook = async (runbook: Runbook) => {
        try {
            const response = await fetch(`/api/runbooks/${runbook.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !runbook.enabled }),
            })
            if (response.ok) {
                fetchRunbooks()
            }
        } catch (error) {
            console.error('Failed to toggle runbook:', error)
        }
    }

    const deleteRunbook = async (runbookId: string) => {
        if (!confirm('Are you sure you want to delete this runbook?')) return
        try {
            const response = await fetch(`/api/runbooks/${runbookId}`, {
                method: 'DELETE',
            })
            if (response.ok) {
                fetchRunbooks()
            }
        } catch (error) {
            console.error('Failed to delete runbook:', error)
        }
    }

    const addInvestigationStep = () => {
        setNewRunbook({
            ...newRunbook,
            investigation_steps: [
                ...newRunbook.investigation_steps,
                { action: 'check_error_rate', params: {}, reason: '' }
            ],
        })
    }

    const removeInvestigationStep = (index: number) => {
        setNewRunbook({
            ...newRunbook,
            investigation_steps: newRunbook.investigation_steps.filter((_, i) => i !== index),
        })
    }

    const updateInvestigationStep = (index: number, field: string, value: string) => {
        const steps = [...newRunbook.investigation_steps]
        if (field === 'action') {
            steps[index] = { ...steps[index], action: value }
        } else if (field === 'reason') {
            steps[index] = { ...steps[index], reason: value }
        }
        setNewRunbook({ ...newRunbook, investigation_steps: steps })
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

    const getStatusIcon = (runbook: Runbook) => {
        if (!runbook.latest_execution) return null
        if (runbook.latest_execution.status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        if (runbook.latest_execution.status === 'completed') return <CheckCircle2 className="h-4 w-4 text-green-500" />
        if (runbook.latest_execution.status === 'failed') return <XCircle className="h-4 w-4 text-red-500" />
        return null
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
                    <h1 className="text-2xl font-bold">Runbooks</h1>
                    <p className="text-muted-foreground">
                        Investigation playbooks that codify tribal knowledge
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchRunbooks}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh
                    </Button>
                    <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Sparkles className="h-4 w-4 mr-2" />
                                From Template
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Start from a Template</DialogTitle>
                                <DialogDescription>
                                    Choose a pre-built investigation playbook to customize
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-3 py-4 max-h-[60vh] overflow-y-auto">
                                {templates.map((template) => (
                                    <Card
                                        key={template.id}
                                        className="cursor-pointer hover:border-primary transition-colors"
                                        onClick={() => createFromTemplate(template)}
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-base">{template.name}</CardTitle>
                                                <Badge variant="outline">
                                                    {template.investigation_steps.length} steps
                                                </Badge>
                                            </div>
                                            <CardDescription>{template.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1">
                                                {template.investigation_steps.slice(0, 4).map((step, i) => (
                                                    <Badge key={i} variant="secondary" className="text-xs">
                                                        {step.action.replace(/_/g, ' ')}
                                                    </Badge>
                                                ))}
                                                {template.investigation_steps.length > 4 && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        +{template.investigation_steps.length - 4} more
                                                    </Badge>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Dialog open={showCreateDialog} onOpenChange={(open) => {
                        setShowCreateDialog(open)
                        if (!open) resetForm()
                    }}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                New Runbook
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create Runbook</DialogTitle>
                                <DialogDescription>
                                    Define an investigation playbook that runs when alerts match your criteria
                                </DialogDescription>
                            </DialogHeader>
                            <Tabs defaultValue="basic" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="basic">Basic Info</TabsTrigger>
                                    <TabsTrigger value="steps">Investigation Steps</TabsTrigger>
                                    <TabsTrigger value="actions">If Found Actions</TabsTrigger>
                                </TabsList>

                                <TabsContent value="basic" className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="name">Name</Label>
                                        <Input
                                            id="name"
                                            placeholder="e.g., High Latency Investigation"
                                            value={newRunbook.name}
                                            onChange={(e) => setNewRunbook({ ...newRunbook, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="description">Description</Label>
                                        <Textarea
                                            id="description"
                                            placeholder="What does this runbook investigate?"
                                            value={newRunbook.description}
                                            onChange={(e) => setNewRunbook({ ...newRunbook, description: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Trigger Type</Label>
                                        <Select
                                            value={newRunbook.trigger_type}
                                            onValueChange={(value) => setNewRunbook({
                                                ...newRunbook,
                                                trigger_type: value as typeof newRunbook.trigger_type,
                                            })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(TRIGGER_TYPE_INFO).map(([key, info]) => (
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
                                            {TRIGGER_TYPE_INFO[newRunbook.trigger_type].description}
                                        </p>
                                    </div>
                                    {newRunbook.trigger_type === 'alert_pattern' && (
                                        <div className="space-y-2">
                                            <Label htmlFor="pattern">Alert Pattern (regex)</Label>
                                            <Input
                                                id="pattern"
                                                placeholder="e.g., latency|slow|timeout"
                                                value={(newRunbook.trigger_config.pattern as string) || ''}
                                                onChange={(e) => setNewRunbook({
                                                    ...newRunbook,
                                                    trigger_config: { ...newRunbook.trigger_config, pattern: e.target.value },
                                                })}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Use | for OR, . for any character. Case insensitive.
                                            </p>
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="steps" className="space-y-4 pt-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">
                                            Define the investigation steps in order of priority
                                        </p>
                                        <Button variant="outline" size="sm" onClick={addInvestigationStep}>
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Step
                                        </Button>
                                    </div>
                                    <div className="space-y-3">
                                        {newRunbook.investigation_steps.map((step, index) => (
                                            <Card key={index}>
                                                <CardContent className="pt-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                                                            {index + 1}
                                                        </div>
                                                        <div className="flex-1 space-y-3">
                                                            <Select
                                                                value={step.action}
                                                                onValueChange={(value) => updateInvestigationStep(index, 'action', value)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {AVAILABLE_ACTIONS.map((action) => (
                                                                        <SelectItem key={action.value} value={action.value}>
                                                                            <div>
                                                                                <div>{action.label}</div>
                                                                                <div className="text-xs text-muted-foreground">
                                                                                    {action.description}
                                                                                </div>
                                                                            </div>
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Input
                                                                placeholder="Why check this? (optional)"
                                                                value={step.reason || ''}
                                                                onChange={(e) => updateInvestigationStep(index, 'reason', e.target.value)}
                                                            />
                                                        </div>
                                                        {newRunbook.investigation_steps.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => removeInvestigationStep(index)}
                                                            >
                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="actions" className="space-y-4 pt-4">
                                    <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                                        <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                                        <p className="text-sm text-muted-foreground">
                                            Define what the agent should recommend when specific conditions are found.
                                            These encode your team&apos;s tribal knowledge about how to handle different scenarios.
                                        </p>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="space-y-2">
                                            <Label>Recent Deployment Found</Label>
                                            <Textarea
                                                placeholder="e.g., A deployment occurred recently. Review commit changes and consider rollback."
                                                value={newRunbook.if_found_actions.recent_deployment || ''}
                                                onChange={(e) => setNewRunbook({
                                                    ...newRunbook,
                                                    if_found_actions: {
                                                        ...newRunbook.if_found_actions,
                                                        recent_deployment: e.target.value,
                                                    },
                                                })}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>High Error Rate Found</Label>
                                            <Textarea
                                                placeholder="e.g., Error rate is elevated. Check logs for the specific exception type."
                                                value={newRunbook.if_found_actions.high_error_rate || ''}
                                                onChange={(e) => setNewRunbook({
                                                    ...newRunbook,
                                                    if_found_actions: {
                                                        ...newRunbook.if_found_actions,
                                                        high_error_rate: e.target.value,
                                                    },
                                                })}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Database Issues Found</Label>
                                            <Textarea
                                                placeholder="e.g., Database connections are exhausted. Scale pool or check for leaks."
                                                value={newRunbook.if_found_actions.db_connections_high || ''}
                                                onChange={(e) => setNewRunbook({
                                                    ...newRunbook,
                                                    if_found_actions: {
                                                        ...newRunbook.if_found_actions,
                                                        db_connections_high: e.target.value,
                                                    },
                                                })}
                                                rows={2}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Traffic Spike Found</Label>
                                            <Textarea
                                                placeholder="e.g., Traffic is above normal. Consider rate limiting or horizontal scaling."
                                                value={newRunbook.if_found_actions.traffic_spike || ''}
                                                onChange={(e) => setNewRunbook({
                                                    ...newRunbook,
                                                    if_found_actions: {
                                                        ...newRunbook.if_found_actions,
                                                        traffic_spike: e.target.value,
                                                    },
                                                })}
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={createRunbook}
                                    disabled={!newRunbook.name || newRunbook.investigation_steps.length === 0 || isCreating}
                                >
                                    {isCreating ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-2" />
                                    )}
                                    Create Runbook
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList>
                    <TabsTrigger value="runbooks">
                        My Runbooks ({runbooks.length})
                    </TabsTrigger>
                    <TabsTrigger value="templates">
                        Templates ({templates.length})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="runbooks" className="mt-6">
                    {runbooks.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                                <h3 className="text-lg font-medium mb-2">No runbooks yet</h3>
                                <p className="text-muted-foreground text-center max-w-md mb-4">
                                    Runbooks are investigation playbooks that codify your team&apos;s tribal knowledge.
                                    When an alert fires, they guide the AI through your standard investigation process.
                                </p>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setShowTemplateDialog(true)}>
                                        <Sparkles className="h-4 w-4 mr-2" />
                                        Start from Template
                                    </Button>
                                    <Button onClick={() => setShowCreateDialog(true)}>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create from Scratch
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4">
                            {runbooks.map((runbook) => {
                                const typeInfo = TRIGGER_TYPE_INFO[runbook.trigger_type]
                                const TypeIcon = typeInfo.icon

                                return (
                                    <Card key={runbook.id} className={!runbook.enabled ? 'opacity-60' : ''}>
                                        <CardHeader className="pb-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-lg bg-muted ${typeInfo.color}`}>
                                                        <TypeIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            {runbook.name}
                                                            {!runbook.enabled && (
                                                                <Badge variant="secondary">Disabled</Badge>
                                                            )}
                                                        </CardTitle>
                                                        <CardDescription className="mt-1">
                                                            {runbook.description || typeInfo.description}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleRunbook(runbook)}
                                                        title={runbook.enabled ? 'Disable' : 'Enable'}
                                                    >
                                                        {runbook.enabled ? (
                                                            <Pause className="h-4 w-4" />
                                                        ) : (
                                                            <Play className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => deleteRunbook(runbook.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {runbook.investigation_steps.slice(0, 5).map((step, i) => (
                                                    <Badge key={i} variant="outline" className="text-xs">
                                                        {step.action.replace(/_/g, ' ')}
                                                    </Badge>
                                                ))}
                                                {runbook.investigation_steps.length > 5 && (
                                                    <Badge variant="outline" className="text-xs">
                                                        +{runbook.investigation_steps.length - 5} more
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                                <div className="flex items-center gap-2">
                                                    <span>Triggered: {runbook.times_triggered}</span>
                                                </div>
                                                {runbook.success_rate !== null && (
                                                    <div className="flex items-center gap-2">
                                                        <span>Success: {runbook.success_rate}%</span>
                                                    </div>
                                                )}
                                                {runbook.latest_execution && (
                                                    <div className="flex items-center gap-2">
                                                        {getStatusIcon(runbook)}
                                                        <span>
                                                            Last run: {getTimeAgo(runbook.latest_execution.started_at)}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="templates" className="mt-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        {templates.map((template) => (
                            <Card key={template.id} className="group hover:border-primary transition-colors">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{template.name}</CardTitle>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => createFromTemplate(template)}
                                        >
                                            <Copy className="h-4 w-4 mr-1" />
                                            Use
                                        </Button>
                                    </div>
                                    <CardDescription>{template.description}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">
                                                Investigation Steps:
                                            </p>
                                            <div className="space-y-1">
                                                {template.investigation_steps.map((step, i) => (
                                                    <div key={i} className="flex items-center gap-2 text-sm">
                                                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                        <span>{step.action.replace(/_/g, ' ')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-muted-foreground mb-1">
                                                Handles these conditions:
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {Object.keys(template.if_found_actions).slice(0, 4).map((key) => (
                                                    <Badge key={key} variant="secondary" className="text-xs">
                                                        {key.replace(/_/g, ' ')}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Info card */}
            <Card className="bg-muted/30">
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">How Runbooks Work</p>
                            <p>
                                When an alert fires, Scout checks if any runbook&apos;s trigger matches. If so, it follows
                                that runbook&apos;s investigation steps and uses the &quot;if found&quot; actions to provide
                                context-specific recommendations. This codifies your team&apos;s tribal knowledge so
                                investigations are consistent and thorough.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
