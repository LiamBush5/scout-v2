"""
Credential management for the SRE Investigation Agent.

Fetches integration credentials from Supabase Vault.
"""

import os
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Create a Supabase client using service role key for vault access."""
    url = os.getenv("SUPABASE_URL", "https://zokozwblvsdfldvwflhm.supabase.co")
    # Service role key is needed to access vault.decrypted_secrets
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY is required to fetch credentials from vault")

    return create_client(url, key)


def get_integration_credentials(org_id: str, provider: str) -> dict | None:
    """
    Fetch integration credentials from Supabase Vault.

    Args:
        org_id: The organization UUID
        provider: The provider name (datadog, github, slack)

    Returns:
        Dict with credentials or None if not found
    """
    try:
        supabase = get_supabase_client()

        # Query decrypted secrets for this org/provider
        # Secret names follow pattern: {org_id}_{provider}_{credential_name}
        prefix = f"{org_id}_{provider}_"

        result = supabase.rpc(
            "get_integration_secrets",
            {"p_org_id": org_id, "p_provider": provider}
        ).execute()

        if result.data:
            return result.data

        # Fallback: direct query (requires appropriate permissions)
        secrets_result = supabase.from_("vault.decrypted_secrets").select(
            "name, decrypted_secret"
        ).like("name", f"{prefix}%").execute()

        if not secrets_result.data:
            return None

        credentials = {}
        for secret in secrets_result.data:
            # Extract credential name from secret name
            # e.g., "536462dc-..._datadog_api_key" -> "api_key"
            cred_name = secret["name"].replace(prefix, "")
            credentials[cred_name] = secret["decrypted_secret"]

        return credentials if credentials else None

    except Exception as e:
        print(f"Error fetching credentials for {provider}: {e}")
        return None


def get_datadog_credentials(org_id: str) -> dict | None:
    """Get Datadog API credentials for an organization."""
    creds = get_integration_credentials(org_id, "datadog")
    if creds and "api_key" in creds and "app_key" in creds:
        return {
            "api_key": creds["api_key"],
            "app_key": creds["app_key"],
            "site": creds.get("site", "datadoghq.com"),
        }
    return None


def get_github_credentials(org_id: str) -> dict | None:
    """Get GitHub App credentials for an organization."""
    creds = get_integration_credentials(org_id, "github")
    if creds and "installation_id" in creds:
        return {
            "installation_id": creds["installation_id"],
            # GitHub App credentials come from env (shared across orgs)
            "app_id": os.getenv("GITHUB_APP_ID"),
            "private_key": os.getenv("GITHUB_APP_PRIVATE_KEY"),
        }
    return None


def get_slack_credentials(org_id: str) -> dict | None:
    """Get Slack Bot credentials for an organization."""
    creds = get_integration_credentials(org_id, "slack")
    if creds and "bot_token" in creds:
        return {
            "bot_token": creds["bot_token"],
            "channel_id": creds.get("channel_id"),
        }
    return None


def get_all_credentials(org_id: str) -> dict:
    """Get all integration credentials for an organization."""
    return {
        "datadog": get_datadog_credentials(org_id),
        "github": get_github_credentials(org_id),
        "slack": get_slack_credentials(org_id),
    }
