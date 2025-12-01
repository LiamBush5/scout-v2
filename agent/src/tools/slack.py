"""
Slack tools for the SRE Investigation Agent.

Tools for sending investigation results and updates to Slack.
"""

from langchain_core.tools import tool
import json


def create_slack_tools(credentials: dict | None) -> list:
    """
    Create Slack tools with the provided credentials.

    Args:
        credentials: Dict with bot_token, channel_id
    """

    # -------------------------------------------------------------------------
    # send_investigation_result
    # -------------------------------------------------------------------------

    @tool
    def send_investigation_result(
        summary: str,
        root_cause: str | None = None,
        confidence: float = 0.5,
        suggested_actions: list[dict] | None = None,
        channel_id: str | None = None,
        datadog_link: str | None = None,
    ) -> str:
        """
        Send investigation results to Slack with formatted blocks.
        Use this at the END of investigation to report findings.

        Args:
            summary: Brief summary of findings
            root_cause: Identified root cause (if determined)
            confidence: Confidence level 0-1 (default: 0.5)
            suggested_actions: List of {priority: 1-3, action: str, command: str?}
            channel_id: Slack channel ID (uses default if not provided)
            datadog_link: Optional link to Datadog dashboard
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Slack not configured. Please add Slack credentials (bot_token, channel_id) in integrations settings."
            })

        try:
            from slack_sdk import WebClient

            client = WebClient(token=credentials["bot_token"])
            default_channel = credentials.get("channel_id")

            confidence_emoji = "HIGH" if confidence >= 0.8 else "MEDIUM" if confidence >= 0.6 else "LOW"

            blocks = [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": "Investigation Complete", "emoji": True},
                },
                {
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Summary*\n{summary}"},
                },
                {"type": "divider"},
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Root Cause*\n{root_cause or 'Unable to determine'}"},
                        {"type": "mrkdwn", "text": f"*Confidence*\n{confidence_emoji} ({int(confidence * 100)}%)"},
                    ],
                },
            ]

            if suggested_actions:
                actions_text = []
                for i, action in enumerate(suggested_actions):
                    priority = action.get("priority", 3)
                    priority_label = "P1" if priority == 1 else "P2" if priority == 2 else "P3"
                    action_str = f"{priority_label}. {action.get('action', '')}"
                    if action.get("command"):
                        action_str += f"\n   `{action['command']}`"
                    actions_text.append(action_str)

                blocks.append({
                    "type": "section",
                    "text": {"type": "mrkdwn", "text": f"*Suggested Actions*\n" + "\n".join(actions_text)},
                })

            action_elements = [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Helpful", "emoji": True},
                    "action_id": "feedback_helpful",
                    "style": "primary",
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Not Helpful", "emoji": True},
                    "action_id": "feedback_not_helpful",
                },
            ]

            if datadog_link:
                action_elements.append({
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View in Datadog", "emoji": True},
                    "url": datadog_link,
                })

            blocks.append({"type": "actions", "elements": action_elements})

            response = client.chat_postMessage(
                channel=channel_id or default_channel,
                text=f"Investigation Complete: {summary}",
                blocks=blocks,
            )

            return json.dumps({
                "success": True,
                "message_ts": response["ts"],
                "channel": response["channel"],
            }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    # -------------------------------------------------------------------------
    # send_investigation_update
    # -------------------------------------------------------------------------

    @tool
    def send_investigation_update(message: str, phase: str, channel_id: str | None = None) -> str:
        """
        Send a progress update during investigation.

        Args:
            message: Update message
            phase: Current phase (triage, changes, hypothesis, conclusion)
            channel_id: Slack channel ID (uses default if not provided)
        """
        if not credentials:
            return json.dumps({
                "success": False,
                "error": "Slack not configured. Please add Slack credentials (bot_token, channel_id) in integrations settings."
            })

        try:
            from slack_sdk import WebClient

            client = WebClient(token=credentials["bot_token"])
            default_channel = credentials.get("channel_id")

            response = client.chat_postMessage(
                channel=channel_id or default_channel,
                text=f"*{phase.upper()}*: {message}",
            )

            return json.dumps({
                "success": True,
                "message_ts": response["ts"],
                "channel": response["channel"],
            }, indent=2)
        except Exception as e:
            return json.dumps({"success": False, "error": str(e)})

    return [
        send_investigation_result,
        send_investigation_update,
    ]
