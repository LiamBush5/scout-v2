/**
 * Retry utilities with exponential backoff
 */

import { logger } from './logger'
import { isRetryableError } from './errors'

export interface RetryOptions {
    maxAttempts?: number
    initialDelayMs?: number
    maxDelayMs?: number
    backoffMultiplier?: number
    onRetry?: (attempt: number, error: unknown) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    onRetry: () => { },
}

/**
 * Retry a function with exponential backoff
 * Only retries on retryable errors (network, 5xx, rate limits)
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    let lastError: unknown

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            // Don't retry if error is not retryable
            if (!isRetryableError(error)) {
                throw error
            }

            // Don't retry on last attempt
            if (attempt === opts.maxAttempts) {
                break
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
                opts.maxDelayMs
            )

            logger.warn(`Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms`, {
                error: error instanceof Error ? error.message : String(error),
            })

            opts.onRetry?.(attempt, error)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError
}

