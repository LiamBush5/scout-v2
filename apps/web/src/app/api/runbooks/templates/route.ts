import { NextResponse } from 'next/server'

/**
 * Runbook templates - pre-built investigation playbooks for common scenarios
 * These encode tribal knowledge from experienced SREs
 */
const RUNBOOK_TEMPLATES = [
    {
        id: 'high-latency',
        name: 'High Latency Investigation',
        description: 'Standard investigation playbook for latency spikes and slow response times',
        trigger_type: 'alert_pattern',
        trigger_config: {
            pattern: 'latency|slow|timeout|p99|response time',
            severity: ['critical', 'high'],
        },
        investigation_steps: [
            {
                action: 'check_deployments',
                params: { hours_back: 2 },
                reason: 'Most latency issues (70-80%) are caused by recent deployments',
            },
            {
                action: 'check_downstream_health',
                params: {},
                reason: 'Downstream dependencies (databases, caches, APIs) can cause upstream latency',
            },
            {
                action: 'check_db_connections',
                params: {},
                reason: 'Database connection pool exhaustion is a common cause of latency',
            },
            {
                action: 'check_cache_hit_rate',
                params: {},
                reason: 'Cache misses force expensive backend calls',
            },
            {
                action: 'check_traffic_volume',
                params: {},
                reason: 'Traffic spikes can overwhelm services',
            },
        ],
        if_found_actions: {
            recent_deployment: 'A deployment occurred recently. Review the commit changes for performance impacts. Consider rollback if issue persists.',
            db_connections_high: 'Database connections are near capacity. Scale the connection pool or investigate connection leaks.',
            cache_miss_spike: 'Cache hit rate dropped significantly. Check for cache invalidation issues or Redis problems.',
            traffic_spike: 'Traffic is above normal levels. Enable rate limiting or scale horizontally.',
            downstream_unhealthy: 'A downstream dependency is degraded. Check the dependency\'s health and consider circuit breakers.',
        },
    },
    {
        id: 'error-rate-spike',
        name: 'Error Rate Spike Investigation',
        description: 'Standard investigation for sudden increases in error rates',
        trigger_type: 'alert_pattern',
        trigger_config: {
            pattern: 'error|5xx|exception|failure rate|error rate',
            severity: ['critical', 'high'],
        },
        investigation_steps: [
            {
                action: 'check_deployments',
                params: { hours_back: 2 },
                reason: 'Recent code changes are the most common cause of error spikes',
            },
            {
                action: 'search_error_logs',
                params: { limit: 20 },
                reason: 'Error logs reveal the specific exception types and stack traces',
            },
            {
                action: 'check_downstream_health',
                params: {},
                reason: 'Downstream failures can cascade and cause errors',
            },
            {
                action: 'check_resource_usage',
                params: {},
                reason: 'Resource exhaustion (memory, CPU) can trigger errors',
            },
        ],
        if_found_actions: {
            recent_deployment: 'A deployment introduced this issue. Review error-related code changes and consider rollback.',
            new_error_pattern: 'A new error type appeared. This is likely a bug in recent code. Check the stack trace.',
            downstream_errors: 'Errors are originating from a downstream service. Escalate to the owning team.',
            resource_exhaustion: 'Resource limits are being hit. Scale up or investigate memory/CPU leaks.',
        },
    },
    {
        id: 'memory-pressure',
        name: 'Memory Pressure Investigation',
        description: 'Investigation playbook for memory usage alerts and OOM conditions',
        trigger_type: 'alert_pattern',
        trigger_config: {
            pattern: 'memory|OOM|heap|GC|out of memory',
            severity: ['critical', 'high', 'medium'],
        },
        investigation_steps: [
            {
                action: 'check_deployments',
                params: { hours_back: 4 },
                reason: 'Memory leaks are often introduced in recent deployments',
            },
            {
                action: 'check_memory_trend',
                params: { hours_back: 24 },
                reason: 'Gradual memory growth suggests a leak, sudden spikes suggest load or data issues',
            },
            {
                action: 'check_traffic_volume',
                params: {},
                reason: 'High traffic can increase memory usage legitimately',
            },
            {
                action: 'check_cache_size',
                params: {},
                reason: 'In-memory caches can grow unbounded without proper eviction',
            },
        ],
        if_found_actions: {
            recent_deployment: 'Memory increased after deployment. Look for new caching, data structures, or query changes that load more data.',
            gradual_increase: 'Memory is growing steadily - this is a memory leak. Check for unclosed connections, growing collections, or event listener accumulation.',
            traffic_correlated: 'Memory scales with traffic. Consider request-scoped memory optimizations or horizontal scaling.',
            cache_growth: 'Cache is growing unbounded. Implement TTL or LRU eviction policies.',
        },
    },
    {
        id: 'database-issues',
        name: 'Database Issues Investigation',
        description: 'Investigation playbook for database-related alerts (connections, slow queries, replication)',
        trigger_type: 'alert_pattern',
        trigger_config: {
            pattern: 'database|db|postgres|mysql|connection pool|slow query|replication',
            severity: ['critical', 'high', 'medium'],
        },
        investigation_steps: [
            {
                action: 'check_deployments',
                params: { hours_back: 2 },
                reason: 'New queries or ORM changes often cause database issues',
            },
            {
                action: 'check_db_connections',
                params: {},
                reason: 'Connection pool exhaustion prevents new requests',
            },
            {
                action: 'check_slow_queries',
                params: {},
                reason: 'Slow queries can cause connection pileup and cascade failures',
            },
            {
                action: 'check_db_replication_lag',
                params: {},
                reason: 'Replication lag can cause stale reads and consistency issues',
            },
            {
                action: 'check_traffic_volume',
                params: {},
                reason: 'Traffic spikes increase database load',
            },
        ],
        if_found_actions: {
            recent_deployment: 'Check for new queries, ORM changes, or N+1 query patterns introduced in recent code.',
            connections_exhausted: 'Connection pool is full. Scale pool size, add read replicas, or find connection leaks.',
            slow_queries: 'Slow queries detected. Add indexes, optimize queries, or add caching for expensive operations.',
            replication_lag: 'Replication is behind. Check for long-running transactions or consider read/write splitting.',
            high_traffic: 'Database is overloaded from traffic. Add read replicas or implement request caching.',
        },
    },
    {
        id: 'service-degraded',
        name: 'Service Degraded Investigation',
        description: 'General investigation when a service is marked unhealthy or degraded',
        trigger_type: 'service_alert',
        trigger_config: {
            services: [], // User fills in their services
        },
        investigation_steps: [
            {
                action: 'check_similar_incidents',
                params: { days_back: 30 },
                reason: 'Check if this has happened before and what fixed it',
            },
            {
                action: 'check_deployments',
                params: { hours_back: 2 },
                reason: 'Recent changes are the most common cause of degradation',
            },
            {
                action: 'check_error_rate',
                params: {},
                reason: 'High errors indicate bugs or failures',
            },
            {
                action: 'check_latency',
                params: {},
                reason: 'High latency causes timeouts and poor UX',
            },
            {
                action: 'check_resource_usage',
                params: {},
                reason: 'Resource exhaustion can cause degradation',
            },
            {
                action: 'check_downstream_health',
                params: {},
                reason: 'Downstream issues cascade upstream',
            },
        ],
        if_found_actions: {
            past_incident_match: 'This matches a previous incident. Reference the past resolution for guidance.',
            recent_deployment: 'A recent deployment likely caused this. Review changes and consider rollback.',
            high_error_rate: 'Errors are elevated. Check logs for the root cause.',
            high_latency: 'Latency is elevated. Check downstream dependencies and database.',
            resource_pressure: 'Resources are constrained. Scale up or optimize.',
            downstream_issue: 'A downstream service is unhealthy. This may resolve when the dependency recovers.',
        },
    },
]

/**
 * GET /api/runbooks/templates - List available runbook templates
 */
export async function GET() {
    return NextResponse.json({ templates: RUNBOOK_TEMPLATES })
}
