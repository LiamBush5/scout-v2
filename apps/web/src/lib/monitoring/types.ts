/**
 * Monitoring job types and interfaces
 *
 * Centralized type definitions for the monitoring feature.
 */

export type JobType =
    | 'deployment_watcher'
    | 'health_check'
    | 'error_scanner'
    | 'baseline_builder'
    | 'custom'

export type NotifyOn = 'always' | 'issues' | 'never'

export type RunStatus = 'running' | 'completed' | 'failed'

export type FindingType = 'info' | 'warning' | 'error' | 'success'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface Finding {
    type: FindingType
    title: string
    description?: string
    metric?: string
    value?: string | number
}

export interface MonitoringJobRun {
    id: string
    status: RunStatus
    summary: string | null
    findings: Finding[] | null
    error_message: string | null
    alert_sent: boolean
    alert_severity: AlertSeverity | null
    started_at: string
    completed_at: string | null
    duration_ms: number | null
}

export interface MonitoringJob {
    id: string
    org_id: string
    name: string
    description: string | null
    job_type: JobType
    schedule_interval: number
    enabled: boolean
    config: Record<string, unknown>
    slack_channel_id: string | null
    notify_on: NotifyOn
    last_run_at: string | null
    next_run_at: string | null
    consecutive_failures: number
    created_at: string
    created_by: string
}

export interface MonitoringJobWithRun extends MonitoringJob {
    latest_run: MonitoringJobRun | null
}

export interface Credentials {
    datadog?: {
        apiKey: string
        appKey: string
        site: string
    }
    github?: {
        appId: string
        privateKey: string
        installationId: number
    }
    slack?: {
        botToken: string
        channelId: string
    }
}

export interface JobExecutionResult {
    success: boolean
    summary: string
    findings: Finding[]
    alertSent: boolean
}
