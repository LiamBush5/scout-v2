-- =============================================================================
-- SUPABASE COMPLETE SETUP FOR SRE AGENT MVP
-- =============================================================================
-- Run this entire file in the Supabase SQL Editor to set up your project
-- 
-- Features:
-- ✅ Multi-tenant architecture with RLS
-- ✅ Google, GitHub, Email/Password authentication
-- ✅ Vault for encrypted credential storage
-- ✅ Realtime subscriptions for live investigation updates
-- ✅ Storage buckets for file uploads
-- ✅ Database triggers for automatic user/org creation
-- ✅ Helper functions for common operations
-- =============================================================================

-- =============================================================================
-- PART 1: ENABLE REQUIRED EXTENSIONS
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Vault for encrypted secrets (should already be enabled)
CREATE EXTENSION IF NOT EXISTS "supabase_vault";

-- Enable pg_net for HTTP requests from database (webhooks)
CREATE EXTENSION IF NOT EXISTS "pg_net";


-- =============================================================================
-- PART 2: CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Organizations (Multi-tenant root)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    logo_url TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for slug lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- -----------------------------------------------------------------------------
-- Organization Members (User <-> Org relationship)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, org_id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members(org_id);

-- -----------------------------------------------------------------------------
-- User Profiles (Extended user info)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    current_org_id UUID REFERENCES public.organizations(id),
    onboarding_step INTEGER DEFAULT 0,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- Integrations (Connection status, NOT credentials)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('datadog', 'github', 'slack', 'pagerduty')),
    status TEXT NOT NULL CHECK (status IN ('connected', 'disconnected', 'error')) DEFAULT 'disconnected',
    metadata JSONB DEFAULT '{}', -- Non-sensitive info like repo names, channel names
    connected_by UUID REFERENCES auth.users(id),
    connected_at TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org_id ON public.integrations(org_id);

-- -----------------------------------------------------------------------------
-- Investigations (Core investigation records)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Trigger info
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('datadog_webhook', 'manual', 'scheduled')),
    trigger_payload JSONB,
    monitor_id TEXT,
    monitor_name TEXT,
    alert_name TEXT,
    service TEXT,
    environment TEXT DEFAULT 'prod',
    severity TEXT CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    
    -- Investigation status
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    
    -- Results
    summary TEXT,
    root_cause TEXT,
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    findings JSONB DEFAULT '[]',
    suggested_actions JSONB DEFAULT '[]',
    deployments_found JSONB DEFAULT '[]',
    
    -- Tracing
    langsmith_run_id TEXT,
    langsmith_url TEXT,
    tool_calls INTEGER DEFAULT 0,
    
    -- Feedback
    feedback_rating TEXT CHECK (feedback_rating IN ('helpful', 'not_helpful')),
    feedback_comment TEXT,
    feedback_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_investigations_org_id ON public.investigations(org_id);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON public.investigations(status);
CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON public.investigations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_service ON public.investigations(service);

-- -----------------------------------------------------------------------------
-- Investigation Events (Timeline of investigation steps)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investigation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('phase_change', 'tool_call', 'finding', 'error', 'hypothesis')),
    event_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investigation_events_investigation_id ON public.investigation_events(investigation_id);

-- -----------------------------------------------------------------------------
-- Webhook Logs (Audit trail for incoming webhooks)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    source TEXT NOT NULL, -- 'datadog', 'github', 'slack'
    payload JSONB,
    headers JSONB,
    processed BOOLEAN DEFAULT FALSE,
    investigation_id UUID REFERENCES public.investigations(id),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_org_id ON public.webhook_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);


-- =============================================================================
-- PART 3: ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investigation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Helper function: Get user's org IDs
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_org_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- Helper function: Check if user is member of org
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.org_members 
        WHERE user_id = auth.uid() 
        AND org_id = check_org_id
    );
$$;

-- -----------------------------------------------------------------------------
-- Helper function: Check if user is org admin/owner
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_admin(check_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.org_members 
        WHERE user_id = auth.uid() 
        AND org_id = check_org_id
        AND role IN ('owner', 'admin')
    );
$$;

-- -----------------------------------------------------------------------------
-- Organizations Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view their organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Admins can update their organizations"
ON public.organizations FOR UPDATE
TO authenticated
USING (public.is_org_admin(id))
WITH CHECK (public.is_org_admin(id));

CREATE POLICY "Anyone can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Org Members Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view members of their orgs"
ON public.org_members FOR SELECT
TO authenticated
USING (org_id IN (SELECT public.get_user_org_ids()));

CREATE POLICY "Admins can manage members"
ON public.org_members FOR ALL
TO authenticated
USING (public.is_org_admin(org_id))
WITH CHECK (public.is_org_admin(org_id));

CREATE POLICY "Users can view their own membership"
ON public.org_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Profiles Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- Integrations Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Members can view org integrations"
ON public.integrations FOR SELECT
TO authenticated
USING (public.is_org_member(org_id));

CREATE POLICY "Admins can manage integrations"
ON public.integrations FOR ALL
TO authenticated
USING (public.is_org_admin(org_id))
WITH CHECK (public.is_org_admin(org_id));

-- -----------------------------------------------------------------------------
-- Investigations Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Members can view org investigations"
ON public.investigations FOR SELECT
TO authenticated
USING (public.is_org_member(org_id));

CREATE POLICY "Members can create investigations"
ON public.investigations FOR INSERT
TO authenticated
WITH CHECK (public.is_org_member(org_id));

CREATE POLICY "Members can update org investigations"
ON public.investigations FOR UPDATE
TO authenticated
USING (public.is_org_member(org_id))
WITH CHECK (public.is_org_member(org_id));

-- -----------------------------------------------------------------------------
-- Investigation Events Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Members can view investigation events"
ON public.investigation_events FOR SELECT
TO authenticated
USING (
    investigation_id IN (
        SELECT id FROM public.investigations 
        WHERE org_id IN (SELECT public.get_user_org_ids())
    )
);

CREATE POLICY "System can insert events"
ON public.investigation_events FOR INSERT
TO authenticated
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Webhook Logs Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs FOR SELECT
TO authenticated
USING (public.is_org_admin(org_id));


-- =============================================================================
-- PART 4: VAULT FUNCTIONS FOR SECURE CREDENTIAL STORAGE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Store an integration secret in Vault
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_integration_secret(
    p_org_id UUID,
    p_provider TEXT,
    p_secret_type TEXT, -- 'api_key', 'app_key', 'bot_token', 'private_key', etc.
    p_secret_value TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_secret_name TEXT;
    v_secret_id UUID;
BEGIN
    -- Check if user is admin of this org
    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Permission denied: user is not an admin of this organization';
    END IF;
    
    -- Create unique secret name
    v_secret_name := p_org_id::text || '_' || p_provider || '_' || p_secret_type;
    
    -- Delete existing secret if any
    DELETE FROM vault.secrets WHERE name = v_secret_name;
    
    -- Insert new secret
    INSERT INTO vault.secrets (name, secret, description)
    VALUES (
        v_secret_name,
        p_secret_value,
        'Integration credential for ' || p_provider || ' (' || p_secret_type || ')'
    )
    RETURNING id INTO v_secret_id;
    
    RETURN v_secret_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Get an integration secret from Vault (for server-side use only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_integration_secret(
    p_org_id UUID,
    p_provider TEXT,
    p_secret_type TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_secret_name TEXT;
    v_secret_value TEXT;
BEGIN
    v_secret_name := p_org_id::text || '_' || p_provider || '_' || p_secret_type;
    
    SELECT decrypted_secret INTO v_secret_value
    FROM vault.decrypted_secrets
    WHERE name = v_secret_name
    LIMIT 1;
    
    RETURN v_secret_value;
END;
$$;

-- -----------------------------------------------------------------------------
-- Delete an integration secret from Vault
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_integration_secret(
    p_org_id UUID,
    p_provider TEXT,
    p_secret_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_secret_name TEXT;
    v_deleted BOOLEAN;
BEGIN
    -- Check if user is admin of this org
    IF NOT public.is_org_admin(p_org_id) THEN
        RAISE EXCEPTION 'Permission denied: user is not an admin of this organization';
    END IF;
    
    v_secret_name := p_org_id::text || '_' || p_provider || '_' || p_secret_type;
    
    DELETE FROM vault.secrets WHERE name = v_secret_name;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$;

-- -----------------------------------------------------------------------------
-- Get all credentials for an org (for agent use)
-- Returns credentials as JSONB - ONLY call from server-side
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_org_credentials(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_result JSONB := '{}';
    v_prefix TEXT;
    v_secret RECORD;
BEGIN
    v_prefix := p_org_id::text || '_';
    
    FOR v_secret IN
        SELECT name, decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name LIKE v_prefix || '%'
    LOOP
        -- Parse secret name: org_id_provider_type
        DECLARE
            v_parts TEXT[];
            v_provider TEXT;
            v_type TEXT;
        BEGIN
            v_parts := string_to_array(v_secret.name, '_');
            IF array_length(v_parts, 1) >= 3 THEN
                v_provider := v_parts[2];
                v_type := v_parts[3];
                
                -- Build nested structure: {provider: {type: value}}
                IF NOT v_result ? v_provider THEN
                    v_result := v_result || jsonb_build_object(v_provider, '{}'::jsonb);
                END IF;
                
                v_result := jsonb_set(
                    v_result,
                    ARRAY[v_provider, v_type],
                    to_jsonb(v_secret.decrypted_secret)
                );
            END IF;
        END;
    END LOOP;
    
    RETURN v_result;
END;
$$;


-- =============================================================================
-- PART 5: AUTOMATIC USER/ORG CREATION TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Handle new user signup
-- Creates profile and default organization
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_org_id UUID;
    v_org_slug TEXT;
    v_full_name TEXT;
BEGIN
    -- Extract full name from metadata
    v_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Create profile
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        v_full_name,
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    -- Generate unique org slug from email domain or username
    v_org_slug := LOWER(REGEXP_REPLACE(
        split_part(NEW.email, '@', 1),
        '[^a-z0-9]',
        '-',
        'g'
    )) || '-' || SUBSTRING(NEW.id::text FROM 1 FOR 8);
    
    -- Create default organization
    INSERT INTO public.organizations (name, slug)
    VALUES (v_full_name || '''s Organization', v_org_slug)
    RETURNING id INTO v_org_id;
    
    -- Add user as owner of the organization
    INSERT INTO public.org_members (user_id, org_id, role, joined_at)
    VALUES (NEW.id, v_org_id, 'owner', NOW());
    
    -- Set current org in profile
    UPDATE public.profiles
    SET current_org_id = v_org_id
    WHERE id = NEW.id;
    
    -- Create default integration records (disconnected)
    INSERT INTO public.integrations (org_id, provider, status)
    VALUES
        (v_org_id, 'datadog', 'disconnected'),
        (v_org_id, 'github', 'disconnected'),
        (v_org_id, 'slack', 'disconnected');
    
    RETURN NEW;
END;
$$;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Update timestamps automatically
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply to all tables
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_investigations_updated_at
    BEFORE UPDATE ON public.investigations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- =============================================================================
-- PART 6: REALTIME SETUP
-- =============================================================================

-- Enable Realtime for investigations table
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime;

-- Add investigations to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.investigations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.investigation_events;

-- -----------------------------------------------------------------------------
-- Function to broadcast investigation updates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.broadcast_investigation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Broadcast to org-specific channel
    PERFORM realtime.broadcast_changes(
        'investigation:' || NEW.org_id::text,
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        OLD
    );
    RETURN NEW;
END;
$$;

-- Trigger for investigation broadcasts
DROP TRIGGER IF EXISTS broadcast_investigation_changes ON public.investigations;
CREATE TRIGGER broadcast_investigation_changes
    AFTER INSERT OR UPDATE ON public.investigations
    FOR EACH ROW
    EXECUTE FUNCTION public.broadcast_investigation_update();


-- =============================================================================
-- PART 7: STORAGE SETUP
-- =============================================================================

-- Create storage bucket for investigation attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'investigation-attachments',
    'investigation-attachments',
    false,
    5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'application/pdf', 'text/plain', 'application/json']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
CREATE POLICY "Users can upload to their org folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'investigation-attachments'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.organizations 
        WHERE id IN (SELECT public.get_user_org_ids())
    )
);

CREATE POLICY "Users can view files in their org folder"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'investigation-attachments'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.organizations 
        WHERE id IN (SELECT public.get_user_org_ids())
    )
);

CREATE POLICY "Admins can delete files in their org folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'investigation-attachments'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.organizations 
        WHERE id IN (SELECT public.get_user_org_ids())
    )
    AND public.is_org_admin(((storage.foldername(name))[1])::uuid)
);


-- =============================================================================
-- PART 8: HELPER FUNCTIONS FOR APPLICATION
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Get current user's profile with org info
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'full_name', p.full_name,
        'avatar_url', p.avatar_url,
        'current_org', jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'slug', o.slug,
            'onboarding_completed', o.onboarding_completed
        ),
        'organizations', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', org.id,
                'name', org.name,
                'slug', org.slug,
                'role', om.role
            ))
            FROM public.org_members om
            JOIN public.organizations org ON org.id = om.org_id
            WHERE om.user_id = auth.uid()
        )
    ) INTO v_result
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.id = p.current_org_id
    WHERE p.id = auth.uid();
    
    RETURN v_result;
END;
$$;

-- -----------------------------------------------------------------------------
-- Switch current organization
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.switch_organization(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Verify user is member of target org
    IF NOT public.is_org_member(p_org_id) THEN
        RAISE EXCEPTION 'User is not a member of this organization';
    END IF;
    
    -- Update current org
    UPDATE public.profiles
    SET current_org_id = p_org_id
    WHERE id = auth.uid();
    
    RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- Create a new investigation (from webhook or manual)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_investigation(
    p_org_id UUID,
    p_trigger_type TEXT,
    p_trigger_payload JSONB DEFAULT NULL,
    p_alert_name TEXT DEFAULT NULL,
    p_service TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT 'medium'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_investigation_id UUID;
BEGIN
    INSERT INTO public.investigations (
        org_id,
        trigger_type,
        trigger_payload,
        alert_name,
        service,
        severity,
        status
    )
    VALUES (
        p_org_id,
        p_trigger_type,
        p_trigger_payload,
        p_alert_name,
        p_service,
        p_severity,
        'queued'
    )
    RETURNING id INTO v_investigation_id;
    
    RETURN v_investigation_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- Update investigation status and results
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_investigation(
    p_investigation_id UUID,
    p_status TEXT,
    p_summary TEXT DEFAULT NULL,
    p_root_cause TEXT DEFAULT NULL,
    p_confidence_score FLOAT DEFAULT NULL,
    p_findings JSONB DEFAULT NULL,
    p_suggested_actions JSONB DEFAULT NULL,
    p_deployments_found JSONB DEFAULT NULL,
    p_tool_calls INTEGER DEFAULT NULL,
    p_langsmith_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_started_at TIMESTAMPTZ;
BEGIN
    -- Get started_at for duration calculation
    SELECT started_at INTO v_started_at
    FROM public.investigations
    WHERE id = p_investigation_id;
    
    UPDATE public.investigations
    SET
        status = p_status,
        completed_at = NOW(),
        duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - COALESCE(v_started_at, created_at)))::INTEGER,
        summary = COALESCE(p_summary, summary),
        root_cause = COALESCE(p_root_cause, root_cause),
        confidence_score = COALESCE(p_confidence_score, confidence_score),
        findings = COALESCE(p_findings, findings),
        suggested_actions = COALESCE(p_suggested_actions, suggested_actions),
        deployments_found = COALESCE(p_deployments_found, deployments_found),
        tool_calls = COALESCE(p_tool_calls, tool_calls),
        langsmith_url = COALESCE(p_langsmith_url, langsmith_url)
    WHERE id = p_investigation_id;
    
    RETURN true;
END;
$$;


-- =============================================================================
-- PART 9: REALTIME AUTHORIZATION POLICIES
-- =============================================================================

-- Allow authenticated users to receive broadcasts for their orgs
CREATE POLICY "Users can receive broadcasts for their orgs"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (
    -- Extract org_id from topic (format: "investigation:org_id")
    CASE 
        WHEN topic LIKE 'investigation:%' THEN
            public.is_org_member(SUBSTRING(topic FROM 15)::UUID)
        ELSE
            true
    END
);


-- =============================================================================
-- PART 10: INDEXES FOR PERFORMANCE
-- =============================================================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_investigations_org_status 
ON public.investigations(org_id, status);

CREATE INDEX IF NOT EXISTS idx_investigations_org_created 
ON public.investigations(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_members_user_org 
ON public.org_members(user_id, org_id);

-- GIN index for JSONB searches
CREATE INDEX IF NOT EXISTS idx_investigations_findings_gin 
ON public.investigations USING GIN (findings);

CREATE INDEX IF NOT EXISTS idx_investigations_trigger_payload_gin 
ON public.investigations USING GIN (trigger_payload);


-- =============================================================================
-- DONE! Your Supabase project is now configured for the SRE Agent MVP
-- =============================================================================

-- Summary of what was created:
-- 
-- TABLES:
--   - organizations: Multi-tenant root
--   - org_members: User-organization relationships
--   - profiles: Extended user profiles
--   - integrations: Integration connection status
--   - investigations: Core investigation records
--   - investigation_events: Investigation timeline
--   - webhook_logs: Webhook audit trail
--
-- RLS POLICIES:
--   - All tables secured with org-based isolation
--   - Helper functions for permission checks
--
-- VAULT FUNCTIONS:
--   - store_integration_secret(): Save credentials
--   - get_integration_secret(): Retrieve credentials
--   - delete_integration_secret(): Remove credentials
--   - get_org_credentials(): Get all org credentials for agent
--
-- TRIGGERS:
--   - on_auth_user_created: Auto-create profile and org on signup
--   - update_*_updated_at: Auto-update timestamps
--   - broadcast_investigation_changes: Realtime updates
--
-- STORAGE:
--   - investigation-attachments bucket with RLS
--
-- REALTIME:
--   - investigations and investigation_events tables
--   - Broadcast function for custom channels
