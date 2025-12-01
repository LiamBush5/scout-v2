/**
 * Application-wide constants
 * Centralized configuration values to avoid magic strings
 */

/** Navigation routes */
export const ROUTES = {
    HOME: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    DASHBOARD: '/dashboard',
    SETTINGS: '/dashboard/settings',
    INTEGRATIONS: '/dashboard/integrations',
    INVESTIGATIONS: '/dashboard/investigations',
    INVESTIGATION_DETAIL: (id: string) => `/dashboard/investigations/${id}`,
    ONBOARDING: '/onboarding',
} as const

/** External URLs */
export const EXTERNAL_URLS = {
    DOCS: 'https://docs.example.com',
    SUPPORT: 'mailto:support@example.com',
    DATADOG_MONITORS: 'https://app.datadoghq.com/monitors/manage',
    DATADOG_WEBHOOK_DOCS: 'https://docs.datadoghq.com/integrations/webhooks/',
} as const

/** Integration providers */
export const PROVIDERS = {
    GITHUB: 'github',
    SLACK: 'slack',
    DATADOG: 'datadog',
    PAGERDUTY: 'pagerduty',
} as const

/** Investigation phases */
export const INVESTIGATION_PHASES = {
    TRIAGE: 'triage',
    CHANGES: 'changes',
    HYPOTHESIS: 'hypothesis',
    CONCLUSION: 'conclusion',
} as const

/** Investigation statuses */
export const INVESTIGATION_STATUS = {
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
} as const

/** Severity levels */
export const SEVERITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
} as const

/** Agent configuration */
export const AGENT_CONFIG = {
    MAX_ITERATIONS: 15,
    MAX_TOKENS: 4096,
    MODEL: 'claude-sonnet-4-20250514',
    TEMPERATURE: 0,
} as const

/** Datadog sites */
export const DATADOG_SITES = [
    'datadoghq.com',
    'datadoghq.eu',
    'us3.datadoghq.com',
    'us5.datadoghq.com',
] as const

/** Time constants (in milliseconds) */
export const TIME = {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
} as const

