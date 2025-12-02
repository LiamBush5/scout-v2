import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getUserOrg } from '@/lib/auth/helpers'
import { logger } from '@/lib/utils/logger'
import { AuthenticationError, NotFoundError, getErrorMessage } from '@/lib/utils/errors'

// POST - Complete onboarding setup
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const auth = await getUserOrg(supabase)
        if ('error' in auth) {
            if (auth.status === 401) {
                throw new AuthenticationError('User not authenticated')
            }
            throw new NotFoundError('Organization', auth.error)
        }

        const body = await request.json()
        const { selectedRepos } = body

        const orgId = auth.orgId
        const supabaseAdmin = getSupabaseAdmin()

        logger.info('Completing onboarding', { userId: auth.userId, orgId })

        // Update organization onboarding status
        const { error: updateError } = await supabaseAdmin
            .from('organizations')
            .update({
                onboarding_completed: true,
                updated_at: new Date().toISOString(),
            })
            .eq('id', orgId)

        if (updateError) {
            logger.error('Failed to update organization onboarding status', updateError, { orgId })
            throw updateError
        }

        // Store selected repositories if provided
        if (selectedRepos && Array.isArray(selectedRepos) && selectedRepos.length > 0) {
            // In production, you might want to store this in a separate table
            // For now, we'll store it in the organization settings JSONB field
            const { data: org, error: fetchError } = await supabaseAdmin
                .from('organizations')
                .select('settings')
                .eq('id', orgId)
                .single()

            if (fetchError) {
                logger.error('Failed to fetch organization settings', fetchError, { orgId })
                throw fetchError
            }

            const currentSettings = (org?.settings as Record<string, unknown>) || {}

            const { error: settingsError } = await supabaseAdmin
                .from('organizations')
                .update({
                    settings: {
                        ...currentSettings,
                        monitored_repositories: selectedRepos,
                    },
                    updated_at: new Date().toISOString(),
                })
                .eq('id', orgId)

            if (settingsError) {
                logger.error('Failed to update organization settings', settingsError, { orgId })
                throw settingsError
            }

            logger.info('Stored selected repositories', { orgId, repoCount: selectedRepos.length })
        }

        logger.info('Onboarding completed successfully', { userId: auth.userId, orgId })
        return NextResponse.json({ success: true, message: 'Onboarding completed successfully' })
    } catch (error) {
        logger.error('Onboarding complete error', error)

        if (error instanceof AuthenticationError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }

        if (error instanceof NotFoundError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode })
        }

        return NextResponse.json(
            { error: getErrorMessage(error) || 'Failed to complete onboarding' },
            { status: 500 }
        )
    }
}

