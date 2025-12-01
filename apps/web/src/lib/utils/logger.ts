/**
 * Structured logging utility
 * Provides consistent logging format with context
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
    [key: string]: unknown
}

class Logger {
    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString()
        const logEntry = {
            timestamp,
            level,
            message,
            ...context,
        }
        return JSON.stringify(logEntry)
    }

    debug(message: string, context?: LogContext): void {
        if (process.env.NODE_ENV === 'development') {
            console.debug(this.formatMessage('debug', message, context))
        }
    }

    info(message: string, context?: LogContext): void {
        console.log(this.formatMessage('info', message, context))
    }

    warn(message: string, errorOrContext?: unknown, context?: LogContext): void {
        const logContext: LogContext = { ...context }

        if (errorOrContext instanceof Error) {
            logContext.error = {
                name: errorOrContext.name,
                message: errorOrContext.message,
                stack: errorOrContext.stack,
            }
        } else if (errorOrContext && typeof errorOrContext === 'object') {
            Object.assign(logContext, errorOrContext)
        } else if (errorOrContext) {
            logContext.error = String(errorOrContext)
        }

        console.warn(this.formatMessage('warn', message, logContext))
    }

    error(message: string, errorOrContext?: unknown, context?: LogContext): void {
        // Support both error(message, error) and error(message, context) signatures
        const errorContext: LogContext = { ...context }

        if (errorOrContext instanceof Error) {
            errorContext.error = {
                name: errorOrContext.name,
                message: errorOrContext.message,
                stack: errorOrContext.stack,
            }
        } else if (errorOrContext && typeof errorOrContext === 'object') {
            // If second arg is context object, merge it
            Object.assign(errorContext, errorOrContext)
        } else if (errorOrContext) {
            errorContext.error = String(errorOrContext)
        }

        console.error(this.formatMessage('error', message, errorContext))
    }
}

export const logger = new Logger()

