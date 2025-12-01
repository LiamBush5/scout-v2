"""Agent tools for SRE investigation."""

__all__ = ["create_datadog_tools", "create_github_tools", "create_slack_tools", "create_memory_tools"]

def create_datadog_tools(credentials: dict) -> list:
    from src.tools.datadog import create_datadog_tools as _create
    return _create(credentials)

def create_github_tools(credentials: dict) -> list:
    from src.tools.github import create_github_tools as _create
    return _create(credentials)

def create_slack_tools(credentials: dict) -> list:
    from src.tools.slack import create_slack_tools as _create
    return _create(credentials)

def create_memory_tools(org_id: str | None = None) -> list:
    from src.tools.memory import create_memory_tools as _create
    return _create(org_id)

