import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Credential schemas for runtime validation of vault data.
 * These ensure that data retrieved from Supabase Vault matches expected types.
 */
const DatadogCredentialsSchema = z.object({
    apiKey: z.string().min(1).nullable(),
    appKey: z.string().min(1).nullable(),
    site: z.string().default('datadoghq.com'),
})

const GitHubCredentialsSchema = z.object({
    appId: z.string().min(1).nullable(),
    privateKey: z.string().min(1).nullable(),
    installationId: z.string().min(1).nullable(),
})

const SlackCredentialsSchema = z.object({
    botToken: z.string().min(1).nullable(),
    channelId: z.string().min(1).nullable(),
})

export type DatadogCredentials = z.infer<typeof DatadogCredentialsSchema>
export type GitHubCredentials = z.infer<typeof GitHubCredentialsSchema>
export type SlackCredentials = z.infer<typeof SlackCredentialsSchema>

export interface Credentials {
    datadog: DatadogCredentials | null
    github: GitHubCredentials | null
    slack: SlackCredentials | null
}

/**
 * Loads all integration credentials for an organization from Supabase Vault.
 * Uses the monitoring credentials loader internally and validates with Zod schemas.
 *
 * @param orgId - The organization ID to load credentials for
 * @returns Credentials object with validated provider credentials or null
 */
export async function loadCredentialsForOrg(orgId: string): Promise<Credentials> {
    const supabaseAdmin = getSupabaseAdmin()

    // Use the monitoring credentials loader
    const { loadCredentials } = await import('@/lib/monitoring/credentials')
    const rawCreds = await loadCredentials(orgId, supabaseAdmin)

    // Validate and transform to match expected schema
    const result: Credentials = {
        datadog: null,
        github: null,
        slack: null,
    }

    if (rawCreds.datadog) {
        const parsed = DatadogCredentialsSchema.safeParse(rawCreds.datadog)
        if (parsed.success) {
            result.datadog = parsed.data
        }
    }

    if (rawCreds.github) {
        const parsed = GitHubCredentialsSchema.safeParse({
            appId: rawCreds.github.appId,
            privateKey: rawCreds.github.privateKey,
            installationId: String(rawCreds.github.installationId),
        })
        if (parsed.success) {
            result.github = parsed.data
        }
    }

    if (rawCreds.slack) {
        const parsed = SlackCredentialsSchema.safeParse(rawCreds.slack)
        if (parsed.success) {
            result.slack = parsed.data
        }
    }

    return result
}

/**
 * Checks if an organization has valid credentials for a specific provider.
 * Useful for quick checks without loading all credentials.
 */
export async function hasCredentialsForProvider(
    orgId: string,
    provider: 'datadog' | 'github' | 'slack'
): Promise<boolean> {
    const credentials = await loadCredentialsForOrg(orgId)

    switch (provider) {
        case 'datadog':
            return credentials.datadog !== null &&
                credentials.datadog.apiKey !== null &&
                credentials.datadog.appKey !== null
        case 'github':
            return credentials.github !== null &&
                credentials.github.appId !== null &&
                credentials.github.privateKey !== null &&
                credentials.github.installationId !== null
        case 'slack':
            return credentials.slack !== null &&
                credentials.slack.botToken !== null
        default:
            return false
    }
}

/**
 * Formats credentials for the agent API request.
 * Only includes providers with valid credentials.
 */
export function formatCredentialsForAgent(credentials: Credentials): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    if (credentials.datadog) {
        result.datadog = {
            apiKey: credentials.datadog.apiKey,
            appKey: credentials.datadog.appKey,
            site: credentials.datadog.site,
        }
    }

    if (credentials.github) {
        result.github = {
            appId: credentials.github.appId,
            privateKey: credentials.github.privateKey,
            installationId: parseInt(credentials.github.installationId!, 10),
        }
    }

    if (credentials.slack) {
        result.slack = {
            botToken: credentials.slack.botToken,
            channelId: credentials.slack.channelId,
        }
    }

    return result
}
