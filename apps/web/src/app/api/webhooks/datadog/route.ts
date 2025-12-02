import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import { ValidationError, NotFoundError, AppError, getErrorMessage } from '@/lib/utils/errors'
import { parseAndValidate, datadogWebhookPayloadSchema, orgSlugSchema, requireEnv } from '@/lib/utils/validation'

/**
 * Extract organization slug from Datadog tags
 * Looks for tag format: sre_agent_org:<slug>
 */
function extractOrgFromTags(tags?: string | string[]): string | null {
    const tagArray = Array.isArray(tags) ? tags : (tags ? tags.split(',') : [])
    const orgTag = tagArray.find((t) => t.trim().startsWith('sre_agent_org:'))
    if (!orgTag) return null

    const parts = orgTag.split(':')
    return parts.length >= 2 ? parts[1].trim() : null
}

/**
 * Datadog webhook handler
 *
 * Receives alert webhooks from Datadog and creates investigations.
 *
 * Security:
 * - Validates webhook payload structure
 * - Requires org identifier (query param or tag)
 * - Logs all webhooks for audit trail
 *
 * @param request - Next.js request object
 * @returns JSON response with investigation status
 */
export async function POST(request: NextRequest) {
    const requestId = crypto.randomUUID()
    const startTime = Date.now()

    try {
        // Parse and validate payload
        const body = await request.text()
        let payload: unknown

        try {
            payload = JSON.parse(body)
        } catch (error) {
            logger.error('Invalid JSON payload', { requestId, error })
            return NextResponse.json(
                { error: 'Invalid JSON payload', code: 'INVALID_JSON' },
                { status: 400 }
            )
        }

        // Validate payload structure
        const validatedPayload = parseAndValidate(
            payload,
            datadogWebhookPayloadSchema,
            'Invalid webhook payload structure'
        )

        // Extract org identifier
        const orgSlugParam = request.nextUrl.searchParams.get('org')
        const orgSlugFromTags = extractOrgFromTags(validatedPayload.tags)
        const orgSlug = orgSlugParam || orgSlugFromTags

        if (!orgSlug) {
            logger.warn('Missing org identifier', { requestId, hasTags: !!validatedPayload.tags })
            return NextResponse.json(
                {
                    error: 'Missing org identifier',
                    code: 'MISSING_ORG',
                    message: 'Add ?org=<slug> to webhook URL or tag sre_agent_org:<slug> to monitor',
                },
                { status: 400 }
            )
        }

        // Validate org slug format
        try {
            orgSlugSchema.parse(orgSlug)
        } catch {
            logger.warn('Invalid org slug format', { requestId, orgSlug })
            return NextResponse.json(
                { error: 'Invalid org slug format', code: 'INVALID_SLUG' },
                { status: 400 }
            )
        }

        const supabaseAdmin = getSupabaseAdmin()

        // Lookup organization
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('id')
            .eq('slug', orgSlug)
            .single()

        if (orgError || !org) {
            logger.warn('Organization not found', { requestId, orgSlug, error: orgError })
            return NextResponse.json(
                { error: 'Unknown organization', code: 'ORG_NOT_FOUND' },
                { status: 404 }
            )
        }

        // Skip recovery alerts (no investigation needed)
        if (validatedPayload.alert_transition === 'Recovered' ||
            validatedPayload.alert_status === 'Recovered') {
            logger.info('Skipping recovery alert', { requestId, orgId: org.id })
            return NextResponse.json({
                status: 'skipped',
                reason: 'recovery',
                requestId,
            })
        }

        // Extract and normalize alert information
        const alertId = String(validatedPayload.alert_id || validatedPayload.id || 'unknown')
        const alertTitle = String(validatedPayload.alert_title || validatedPayload.title || 'Unknown Alert')
        const alertStatus = String(validatedPayload.alert_transition || validatedPayload.alert_status || 'Triggered')
        const message = String(validatedPayload.body || validatedPayload.message || '')
        const tags = Array.isArray(validatedPayload.tags)
            ? validatedPayload.tags
            : (validatedPayload.tags ? [validatedPayload.tags] : [])
        const link = validatedPayload.link || validatedPayload.url || ''
        const service = extractServiceFromTags(tags)
        const severity = extractSeverity(validatedPayload)

        // Create investigation record
        const { data: investigation, error: investigationError } = await supabaseAdmin
            .from('investigations')
            .insert({
                org_id: org.id,
                trigger_type: 'datadog_webhook',
                trigger_payload: {
                    alert_id: alertId,
                    alert_title: alertTitle,
                    alert_status: alertStatus,
                    message,
                    tags,
                    link,
                },
                monitor_id: alertId,
                monitor_name: alertTitle,
                alert_name: alertTitle,
                service: service || null,
                severity: severity || 'medium',
                status: 'queued',
            })
            .select()
            .single()

        if (investigationError || !investigation) {
            logger.error('Failed to create investigation', {
                requestId,
                orgId: org.id,
                alertId,
                error: investigationError,
            })
            return NextResponse.json(
                {
                    error: 'Failed to create investigation',
                    code: 'INVESTIGATION_CREATE_FAILED',
                    requestId,
                },
                { status: 500 }
            )
        }

        logger.info('Investigation created', {
            requestId,
            investigationId: investigation.id,
            orgId: org.id,
            alertId,
            service,
            severity,
        })

        // Log webhook for audit trail (fire and forget - don't block response)
        void (async () => {
            try {
                await supabaseAdmin
                    .from('webhook_logs')
                    .insert({
                        org_id: org.id,
                        source: 'datadog',
                        payload: validatedPayload,
                        headers: Object.fromEntries(request.headers.entries()),
                        processed: true,
                        investigation_id: investigation.id,
                    })
            } catch (err) {
                logger.error('Failed to log webhook', { requestId, investigationId: investigation.id, error: err })
            }
        })()

        // Trigger agent investigation (fire and forget - async processing)
        const appUrl = requireEnv('NEXT_PUBLIC_APP_URL')
        void fetch(`${appUrl}/api/agent/investigate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Request-ID': requestId,
            },
            body: JSON.stringify({
                investigationId: investigation.id,
                orgId: org.id
            }),
        }).catch((err) => {
            logger.error('Failed to trigger investigation', {
                requestId,
                investigationId: investigation.id,
                error: err,
            })
        })

        const durationMs = Date.now() - startTime

        return NextResponse.json({
            status: 'queued',
            investigation_id: investigation.id,
            message: 'Investigation queued successfully',
            requestId,
            duration_ms: durationMs,
        })
    } catch (error) {
        const durationMs = Date.now() - startTime

        if (error instanceof ValidationError || error instanceof NotFoundError) {
            logger.warn('Webhook validation error', {
                requestId,
                durationMs,
                error: error.message,
                code: error.code,
            })
            return NextResponse.json(
                {
                    error: error.message,
                    code: error.code,
                    requestId,
                },
                { status: error.statusCode }
            )
        }

        logger.error('Webhook processing failed', {
            requestId,
            durationMs,
            error: getErrorMessage(error),
        })

        return NextResponse.json(
            {
                error: 'Webhook processing failed',
                code: 'INTERNAL_ERROR',
                requestId,
            },
            { status: 500 }
        )
    }
}

/**
 * Extract service name from Datadog tags
 * Looks for tag format: service:<name>
 */
function extractServiceFromTags(tags: string | string[]): string | null {
    const tagArray = Array.isArray(tags) ? tags : (tags ? tags.split(',') : [])
    const serviceTag = tagArray.find((t) => t.trim().startsWith('service:'))
    if (!serviceTag) return null

    const parts = serviceTag.split(':')
    return parts.length >= 2 ? parts[1].trim() : null
}

/**
 * Extract severity from Datadog payload
 * Maps priority/severity strings to normalized values
 */
function extractSeverity(
    payload: z.infer<typeof datadogWebhookPayloadSchema>
): 'critical' | 'high' | 'medium' | 'low' | null {
    const priority = String(payload.priority || payload.severity || '').toLowerCase().trim()

    if (priority.includes('critical') || priority.includes('p1')) return 'critical'
    if (priority.includes('high') || priority.includes('p2')) return 'high'
    if (priority.includes('medium') || priority.includes('p3')) return 'medium'
    if (priority.includes('low') || priority.includes('p4')) return 'low'

    return null
}

