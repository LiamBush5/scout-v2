"""
GitHub tools for the SRE Investigation Agent.

Most incidents (70-80%) are caused by recent changes.
These tools help find and analyze deployments.
"""

from langchain_core.tools import tool
from datetime import datetime, timedelta
import json


def create_github_tools(credentials: dict | None) -> list:
    """
    Create GitHub tools with the provided credentials.

    Args:
        credentials: Dict with app_id, private_key, installation_id
    """

    # -------------------------------------------------------------------------
    # get_recent_deployments
    # -------------------------------------------------------------------------

    @tool
    def get_recent_deployments(owner: str, repo: str, hours_back: int = 6, environment: str | None = None) -> str:
        """
        Get recent deployments from a GitHub repository.
        HIGHEST-VALUE tool - most incidents are caused by recent code changes.

        A deployment within 5-60 minutes of the incident is the PRIME SUSPECT.

        Args:
            owner: Repository owner (org or user)
            repo: Repository name
            hours_back: How far back to look (default: 6)
            environment: Filter by environment (e.g., "production")
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "GitHub not configured. Please add GitHub App credentials (app_id, private_key, installation_id) in integrations settings."
            })

        try:
            from github import Github, GithubIntegration

            integration = GithubIntegration(
                integration_id=credentials["app_id"],
                private_key=credentials["private_key"],
            )
            access_token = integration.get_access_token(credentials["installation_id"]).token
            github = Github(access_token)

            repository = github.get_repo(f"{owner}/{repo}")
            cutoff = datetime.utcnow() - timedelta(hours=hours_back)

            deployments = []
            # PyGithub doesn't accept None for environment, use NotSet
            from github import GithubObject
            env_param = environment if environment else GithubObject.NotSet
            for deploy in repository.get_deployments(environment=env_param):
                created = deploy.created_at.replace(tzinfo=None)
                if created < cutoff:
                    break

                statuses = list(deploy.get_statuses())
                status = statuses[0].state if statuses else "unknown"

                minutes_ago = int((datetime.utcnow() - created).total_seconds() / 60)

                deployments.append({
                    "sha": deploy.sha[:7],
                    "full_sha": deploy.sha,
                    "ref": deploy.ref,
                    "environment": deploy.environment,
                    "created_at": deploy.created_at.isoformat(),
                    "creator": deploy.creator.login if deploy.creator else None,
                    "status": status,
                    "minutes_ago": minutes_ago,
                })

            if deployments:
                recent = deployments[0]
                if recent["minutes_ago"] < 60:
                    summary = f"DEPLOYMENT {recent['sha']} deployed {recent['minutes_ago']} min ago - PRIME SUSPECT"
                else:
                    summary = f"Found {len(deployments)} deployments. Most recent: {recent['minutes_ago']} min ago."
            else:
                summary = f"No deployments in the last {hours_back} hours."

            return json.dumps({
                "success": True,
                "repo": f"{owner}/{repo}",
                "summary": summary,
                "deployments": deployments[:10],
            }, indent=2)
        except Exception as e:
            error_msg = str(e) if str(e) and str(e) != "None" else repr(e)
            return json.dumps({"success": False, "error": error_msg})

    # -------------------------------------------------------------------------
    # get_deployment_commits
    # -------------------------------------------------------------------------

    @tool
    def get_deployment_commits(owner: str, repo: str, sha: str, compare_to: str | None = None) -> str:
        """
        Get commits included in a deployment to see what code changed.
        Use after finding a suspicious deployment.

        Args:
            owner: Repository owner
            repo: Repository name
            sha: Deployment SHA
            compare_to: Optional SHA to compare against (e.g., previous deployment)
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "GitHub not configured. Please add GitHub App credentials (app_id, private_key, installation_id) in integrations settings."
            })

        try:
            from github import Github, GithubIntegration

            integration = GithubIntegration(
                integration_id=credentials["app_id"],
                private_key=credentials["private_key"],
            )
            access_token = integration.get_access_token(credentials["installation_id"]).token
            github = Github(access_token)

            repository = github.get_repo(f"{owner}/{repo}")

            if compare_to:
                comparison = repository.compare(compare_to, sha)
                commits = [{
                    "sha": c.sha[:7],
                    "message": c.commit.message.split('\n')[0][:80],
                    "author": c.commit.author.name if c.commit.author else None,
                } for c in list(comparison.commits)[:20]]

                files_list = list(comparison.files)[:20]
                files = [{
                    "filename": f.filename,
                    "status": f.status,
                    "changes": f.changes,
                } for f in files_list]

                high_risk = [f["filename"] for f in files if _is_high_risk(f["filename"])]

                return json.dumps({
                    "success": True,
                    "commits": commits,
                    "files_changed": len(files_list),
                    "high_risk_files": high_risk[:5],
                    "sample_files": files[:10],
                }, indent=2)
            else:
                commit = repository.get_commit(sha)
                files_list = list(commit.files)[:20] if commit.files else []
                files = [{
                    "filename": f.filename,
                    "status": f.status,
                    "changes": f.changes,
                } for f in files_list]

                high_risk = [f["filename"] for f in files if _is_high_risk(f["filename"])]

                return json.dumps({
                    "success": True,
                    "sha": sha[:7],
                    "message": commit.commit.message.split('\n')[0],
                    "author": commit.commit.author.name if commit.commit.author else None,
                    "files_changed": len(files_list),
                    "high_risk_files": high_risk[:5],
                    "sample_files": files[:10],
                }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    def _is_high_risk(filename: str) -> bool:
        """Check if a file is high-risk for causing issues."""
        high_risk_patterns = [
            "database", "migration", ".sql", "schema",
            "config", "settings", "env",
            "auth", "security", "payment",
            "api/", "routes", "controller",
        ]
        return any(p in filename.lower() for p in high_risk_patterns)

    # -------------------------------------------------------------------------
    # get_recent_commits
    # -------------------------------------------------------------------------

    @tool
    def get_recent_commits(owner: str, repo: str, hours_back: int = 24, branch: str = "main") -> str:
        """
        Get recent commits from a repository.

        Args:
            owner: Repository owner
            repo: Repository name
            hours_back: How far back to look (default: 24)
            branch: Branch to check (default: main)
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "GitHub not configured. Please add GitHub App credentials (app_id, private_key, installation_id) in integrations settings."
            })

        try:
            from github import Github, GithubIntegration

            integration = GithubIntegration(
                integration_id=credentials["app_id"],
                private_key=credentials["private_key"],
            )
            access_token = integration.get_access_token(credentials["installation_id"]).token
            github = Github(access_token)

            repository = github.get_repo(f"{owner}/{repo}")
            since = datetime.utcnow() - timedelta(hours=hours_back)

            commits = []
            for commit in repository.get_commits(sha=branch, since=since):
                commits.append({
                    "sha": commit.sha[:7],
                    "message": commit.commit.message.split('\n')[0][:80],
                    "author": commit.commit.author.name if commit.commit.author else None,
                    "date": commit.commit.author.date.isoformat() if commit.commit.author else None,
                })
                if len(commits) >= 20:
                    break

            return json.dumps({
                "success": True,
                "repo": f"{owner}/{repo}",
                "branch": branch,
                "commits": commits,
            }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    return [
        get_recent_deployments,
        get_deployment_commits,
        get_recent_commits,
    ]
