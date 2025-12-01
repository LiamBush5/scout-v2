/**
 * Structured error handling utilities for the SRE Agent
 * Provides consistent error types and logging
 */

export class AppError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly statusCode: number = 500,
        public readonly context?: Record<string, unknown>
    ) {
        super(message)
        this.name = 'AppError'
        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor)
    }
}

export class ValidationError extends AppError {
    constructor(message: string, context?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', 400, context)
        this.name = 'ValidationError'
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string) {
        super(
            `${resource} not found${identifier ? `: ${identifier}` : ''}`,
            'NOT_FOUND',
            404,
            { resource, identifier }
        )
        this.name = 'NotFoundError'
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 'AUTHENTICATION_ERROR', 401)
        this.name = 'AuthenticationError'
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 'AUTHORIZATION_ERROR', 403)
        this.name = 'AuthorizationError'
    }
}

export class ExternalServiceError extends AppError {
    constructor(
        service: string,
        message: string,
        public readonly originalError?: unknown
    ) {
        super(
            `${service} error: ${message}`,
            'EXTERNAL_SERVICE_ERROR',
            502,
            { service, originalError: originalError instanceof Error ? originalError.message : String(originalError) }
        )
        this.name = 'ExternalServiceError'
    }
}

/**
 * Safely extract error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
    if (error instanceof AppError) {
        return error.message
    }
    if (error instanceof Error) {
        return error.message
    }
    if (typeof error === 'string') {
        return error
    }
    return 'An unknown error occurred'
}

/**
 * Check if error is retryable (transient failure)
 */
export function isRetryableError(error: unknown): boolean {
    if (error instanceof ExternalServiceError) {
        // Network errors, timeouts, 5xx errors are retryable
        const status = (error.context?.statusCode as number) || 0
        return status >= 500 || status === 429
    }
    if (error instanceof Error) {
        // Network-related errors are retryable
        return error.message.includes('timeout') ||
            error.message.includes('ECONNRESET') ||
            error.message.includes('ENOTFOUND')
    }
    return false
}

