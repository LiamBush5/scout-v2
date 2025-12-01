/**
 * LangGraph Agent Configuration
 *
 * Centralized configuration for the SRE investigation agent.
 * These values can be overridden via environment variables.
 */

/** Agent execution limits */
export const AGENT_LIMITS = {
    /** Maximum number of agent iterations before forcing conclusion */
    MAX_ITERATIONS: Number(process.env.AGENT_MAX_ITERATIONS) || 15,
    /** Maximum tokens per LLM call */
    MAX_TOKENS: Number(process.env.AGENT_MAX_TOKENS) || 4096,
    /** Target investigation completion time in seconds */
    TARGET_DURATION_SECONDS: 300,
} as const

/** LLM configuration */
export const LLM_CONFIG = {
    /** Model to use for the agent */
    MODEL: process.env.AGENT_MODEL || 'x-ai/grok-4.1-fast:free',
    /** Temperature for LLM calls (0 = deterministic) */
    TEMPERATURE: 0,
    /** Provider */
    PROVIDER: 'openrouter',
    /** OpenRouter base URL */
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
} as const

/** Phase transition thresholds (iteration counts) */
export const PHASE_THRESHOLDS = {
    /** After this many iterations, move from triage to changes */
    TRIAGE_TO_CHANGES: 2,
    /** After this many iterations, move from changes to hypothesis */
    CHANGES_TO_HYPOTHESIS: 5,
    /** After this many iterations, move from hypothesis to conclusion */
    HYPOTHESIS_TO_CONCLUSION: 10,
} as const

/** Investigation phases */
export const PHASES = {
    TRIAGE: 'triage',
    CHANGES: 'changes',
    HYPOTHESIS: 'hypothesis',
    CONCLUSION: 'conclusion',
} as const

export type Phase = typeof PHASES[keyof typeof PHASES]

/** LangSmith tracing configuration */
export const TRACING_CONFIG = {
    /** Project name in LangSmith */
    PROJECT_NAME: process.env.LANGSMITH_PROJECT || 'sre-agent',
    /** Tags to add to all traces */
    DEFAULT_TAGS: ['sre-agent', 'investigation'] as string[],
    /** Enable tracing */
    ENABLED: process.env.LANGSMITH_TRACING === 'true',
}

