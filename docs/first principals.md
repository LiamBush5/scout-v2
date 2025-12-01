# LangGraph SRE Agent - First Principles Design Analysis

## The Core Problem

When a production alert fires, engineers face  **maximum uncertainty** :

* Is this real or a false positive?
* What's the blast radius?
* What changed?
* What's the root cause?

**The agent's job is to reduce uncertainty as fast as possible.**

This is fundamentally an **information gathering** problem, not a code generation problem.

---

## First Principles

### 1. Most Incidents Are Caused by Changes

**Research shows 70-80% of production incidents are caused by recent changes.**

This is THE most important insight for agent design:

* Check deployments FIRST
* Temporal correlation with a deploy is strong evidence
* Don't waste iterations on random exploration

The agent's phase structure reflects this:

```
TRIAGE → CHANGE DETECTION → HYPOTHESIS → CONCLUSION
         ↑
         This is the highest-yield step
```

### 2. Expert SREs Think in Hypotheses

They don't randomly grep logs. They:

1. Form hypotheses based on patterns
2. Design tests for each hypothesis
3. Update confidence based on evidence

The agent should mirror this cognitive model:

* Generate 2-4 ranked hypotheses
* Test systematically
* Track evidence for/against each

### 3. Time is Critical

The first 5 minutes are crucial for MTTR. The agent must:

* Limit iterations (15 max)
* Use high-signal queries first
* Conclude even with partial information
* Never get stuck in exploration loops

### 4. Output Must Be Actionable

Engineers don't want reports. They want:

* What's broken
* Why
* What to do RIGHT NOW

Every agent output should answer: **"What should I do next?"**

---

## Design Decisions

### Graph Topology

**Why not a simple ReAct loop?**

ReAct is great for open-ended exploration, but SRE investigation has structure:

1. You need to understand before you hypothesize
2. You need hypotheses before you test
3. You must conclude and report

Our phased graph enforces this discipline while allowing iteration within phases.

```
START
  │
  ▼
TRIAGE (understand the alert)
  │
  ▼
CHANGE DETECTION (find what changed) ← Most important phase
  │
  ▼
HYPOTHESIS TESTING (validate/invalidate)
  │
  ▼
CONCLUSION (synthesize & report)
  │
  ▼
END
```

### Tool Design Philosophy

Each tool should:

1. **Return interpreted data, not raw dumps** - The agent needs insights, not JSON blobs
2. **Include anomaly detection** - Flag what's unusual
3. **Fail gracefully** - Return helpful error messages
4. **Minimize tokens** - Context is precious

Example: `get_apm_service_summary` returns:

```
⚠️ SERVICE DEGRADED: High error rate: 5.2%; P95 latency increased 150% from baseline
```

Not:

```
{series: [{pointlist: [[1234567890, 0.052], ...]}]}
```

### State Management

The state captures the agent's  **evolving mental model** :

```python
class AgentState(TypedDict):
    # Conversation history (append-only)
    messages: Annotated[Sequence[BaseMessage], add_messages]

    # Current phase of investigation
    phase: str

    # Accumulated knowledge
    hypotheses: list[dict]
    evidence: list[dict]
    recent_deployments: list[dict]
    affected_services: list[str]

    # Progress tracking
    iteration: int
    max_iterations: int
```

Key insight: **State is the agent's working memory.** It must persist the right information to enable good reasoning.

### Prompt Engineering

The system prompt encodes SRE expertise:

1. **Methodology** - Clear investigation phases
2. **Prioritization** - "Check deployments FIRST"
3. **Evidence standards** - "Show your evidence"
4. **Time awareness** - "You have ~15 iterations"
5. **Output format** - Structured for quick scanning

The prompt is the agent's "training" for this domain.

---

## Tool Inventory

### Datadog Tools (Metrics, Logs, APM)

| Tool                      | Purpose                             | When to Use      |
| ------------------------- | ----------------------------------- | ---------------- |
| `get_monitor_details`     | Understand what triggered the alert | First in triage  |
| `get_apm_service_summary` | Service health overview             | Early triage     |
| `query_metrics`           | Test specific hypotheses            | Investigation    |
| `search_logs`             | Find error patterns                 | Investigation    |
| `get_datadog_events`      | Find config/infra changes           | Change detection |

### GitHub Tools (Changes)

| Tool                     | Purpose               | When to Use                  |
| ------------------------ | --------------------- | ---------------------------- |
| `get_recent_deployments` | Find code deployments | Change detection (critical!) |
| `get_deployment_commits` | See what code changed | After finding suspect deploy |
| `get_workflow_runs`      | Check CI/CD status    | Validate deployment success  |

### Slack Tools (Output)

| Tool                        | Purpose          | When to Use         |
| --------------------------- | ---------------- | ------------------- |
| `send_investigation_result` | Deliver findings | Conclusion phase    |
| `send_investigation_update` | Progress updates | Long investigations |

---

## Investigation Flow Example

```
1. Alert: "High Error Rate on checkout-service"

2. TRIAGE:
   → get_monitor_details(12345)
   → "Monitor tracks HTTP 500 errors, threshold 1%, currently 8.5%"

   → get_apm_service_summary("checkout-service")
   → "⚠️ Error rate 8.5%, P95 latency normal, throughput normal"

   Conclusion: Real issue, isolated to checkout-service errors

3. CHANGE DETECTION:
   → get_recent_deployments("myorg", "checkout-service", hours_back=4)
   → "🚨 DEPLOYMENT: abc123 deployed 23 minutes ago"

   → get_datadog_events(hours_back=4, tags=["service:checkout"])
   → "No config changes found"

   Finding: Deployment abc123 correlates with error spike timing

4. HYPOTHESIS TESTING:
   Hypothesis: "Deployment abc123 introduced a bug"

   → search_logs("service:checkout status:error", minutes_back=30)
   → "Top error: NullPointerException in PaymentProcessor.java:142"

   → get_deployment_commits("myorg", "checkout-service", "abc123")
   → "⚠️ HIGH RISK: PaymentProcessor.java modified"

   Evidence: Logs show new error type, code shows relevant file changed

5. CONCLUSION:
   → send_investigation_result(
       summary="Deployment abc123 introduced NPE in PaymentProcessor",
       root_cause="Null check removed in PaymentProcessor.java:142",
       confidence="high",
       evidence=["Error rate spiked 23 min after deploy", "NPE in modified file"],
       recommended_actions=[
         {"priority": 1, "action": "Rollback to previous version",
          "command": "kubectl rollout undo deployment/checkout"}
       ]
     )
```

Total tool calls: 6
Time: ~60 seconds
Result: Actionable root cause with rollback command

---

## Why This Design is Optimal

1. **Phase Structure** - Forces systematic investigation, prevents random exploration
2. **Change-First Priority** - Matches real-world incident patterns
3. **Iteration Limits** - Ensures timely conclusions
4. **Interpreted Tool Output** - Reduces LLM cognitive load
5. **Actionable Output** - Directly useful to engineers

The agent doesn't just describe problems - it helps solve them.

---

## Key Metrics to Track

1. **Time to First Result** - Should be < 60 seconds
2. **Accuracy** - User feedback (helpful/not helpful)
3. **Tool Efficiency** - Useful findings per tool call
4. **Phase Progression** - Does it reach conclusion?
5. **Root Cause Identification Rate** - How often do we find it?

Use LangSmith to trace every investigation and improve over time.
