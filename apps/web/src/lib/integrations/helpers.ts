import { SupabaseClient } from '@supabase/supabase-js'

type Provider = 'datadog' | 'github' | 'slack'

const PROVIDER_SECRETS: Record<Provider, string[]> = {
  datadog: ['api_key', 'app_key', 'site'],
  github: ['installation_id'],
  slack: ['bot_token', 'channel_id'],
}

/**
 * Updates integration status in the database
 */
export async function updateIntegrationStatus(
  orgId: string,
  provider: Provider,
  supabaseAdmin: SupabaseClient,
  status: 'connected' | 'disconnected',
  userId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await supabaseAdmin
    .from('integrations')
    .upsert(
      {
        org_id: orgId,
        provider,
        status,
        connected_by: userId,
        connected_at: status === 'connected' ? new Date().toISOString() : null,
        metadata,
        error_message: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'org_id,provider',
      }
    )
}

/**
 * Disconnects an integration by:
 * 1. Deleting all secrets from vault
 * 2. Updating integration status to disconnected
 */
export async function disconnectIntegration(
  orgId: string,
  provider: Provider,
  supabaseAdmin: SupabaseClient
): Promise<void> {
  const secretTypes = PROVIDER_SECRETS[provider]

  // Delete all secrets for this provider
  await Promise.all(
    secretTypes.map((secretType) =>
      supabaseAdmin.rpc('delete_integration_secret', {
        p_org_id: orgId,
        p_provider: provider,
        p_secret_type: secretType,
      })
    )
  )

  // Update integration status
  await updateIntegrationStatus(orgId, provider, supabaseAdmin, 'disconnected', null)
}

