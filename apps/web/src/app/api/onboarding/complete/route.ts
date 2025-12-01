import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logger } from '@/lib/utils/logger'
import { AuthenticationError, NotFoundError, getErrorMessage } from '@/lib/utils/errors'

function getSupabaseAdmin() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// POST - Complete onboarding setup
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            throw new AuthenticationError('User not authenticated')
        }

        const body = await request.json()
        const { selectedRepos } = body

        // Get user's org
        const { data: profile } = await supabase
            .from('profiles')
            .select('current_org_id')
            .eq('id', user.id)
            .single()

        if (!profile?.current_org_id) {
            throw new NotFoundError('Organization', user.id)
        }

        const orgId = profile.current_org_id
        const supabaseAdmin = getSupabaseAdmin()

        logger.info('Completing onboarding', { userId: user.id, orgId })

        // Update organization onboarding status
        const { error: updateError } = await supabaseAdmin
            .from('organizations')
            .update({
                onboarding_completed: true,
                onboarding_step: 3, // Setup step completed
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

        logger.info('Onboarding completed successfully', { userId: user.id, orgId })
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

