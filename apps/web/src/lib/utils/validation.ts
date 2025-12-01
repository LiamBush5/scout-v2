/**
 * Input validation utilities
 */

import { z } from 'zod'
import { ValidationError } from './errors'

/**
 * Validate UUID format
 */
export const uuidSchema = z.string().uuid()

/**
 * Validate organization slug format
 */
export const orgSlugSchema = z.string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')

/**
 * Validate Datadog monitor ID
 */
export const monitorIdSchema = z.union([
    z.string().regex(/^\d+$/).transform(Number),
    z.number().int().positive(),
])

/**
 * Validate webhook payload structure
 */
export const datadogWebhookPayloadSchema = z.object({
    alert_id: z.union([z.string(), z.number()]).optional(),
    id: z.union([z.string(), z.number()]).optional(),
    alert_title: z.string().optional(),
    title: z.string().optional(),
    alert_transition: z.string().optional(),
    alert_status: z.string().optional(),
    body: z.string().optional(),
    message: z.string().optional(),
    tags: z.union([z.string(), z.array(z.string())]).optional(),
    link: z.string().url().optional(),
    url: z.string().url().optional(),
    priority: z.string().optional(),
    severity: z.string().optional(),
}).passthrough()

/**
 * Safely parse and validate JSON with Zod schema
 */
export function parseAndValidate<T>(
    data: unknown,
    schema: z.ZodSchema<T>,
    errorMessage = 'Validation failed'
): T {
    try {
        return schema.parse(data)
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new ValidationError(
                errorMessage,
                {
                    errors: error.issues.map(issue => ({
                        path: issue.path.join('.'),
                        message: issue.message,
                        code: issue.code,
                    }))
                }
            )
        }
        throw error
    }
}

/**
 * Validate environment variable exists
 */
export function requireEnv(key: string): string {
    const value = process.env[key]
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`)
    }
    return value
}

