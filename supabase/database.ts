// src/types/database.ts
/**
 * Database Types for Supabase
 * 
 * IMPORTANT: This file should be regenerated when your schema changes.
 * Run: npx supabase gen types typescript --linked > src/types/database.ts
 * 
 * This is a starter template that matches our setup.sql schema.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          onboarding_completed: boolean
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          onboarding_completed?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          onboarding_completed?: boolean
          settings?: Json
          created_at?: string
          updated_at?: string
        }
      }
      org_members: {
        Row: {
          id: string
          user_id: string
          org_id: string
          role: 'owner' | 'admin' | 'member'
          invited_by: string | null
          invited_at: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          user_id: string
          org_id: string
          role?: 'owner' | 'admin' | 'member'
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          org_id?: string
          role?: 'owner' | 'admin' | 'member'
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          current_org_id: string | null
          onboarding_step: number
          preferences: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          current_org_id?: string | null
          onboarding_step?: number
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          current_org_id?: string | null
          onboarding_step?: number
          preferences?: Json
          created_at?: string
          updated_at?: string
        }
      }
      integrations: {
        Row: {
          id: string
          org_id: string
          provider: 'datadog' | 'github' | 'slack' | 'pagerduty'
          status: 'connected' | 'disconnected' | 'error'
          metadata: Json
          connected_by: string | null
          connected_at: string | null
          last_verified_at: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          provider: 'datadog' | 'github' | 'slack' | 'pagerduty'
          status?: 'connected' | 'disconnected' | 'error'
          metadata?: Json
          connected_by?: string | null
          connected_at?: string | null
          last_verified_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          provider?: 'datadog' | 'github' | 'slack' | 'pagerduty'
          status?: 'connected' | 'disconnected' | 'error'
          metadata?: Json
          connected_by?: string | null
          connected_at?: string | null
          last_verified_at?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      investigations: {
        Row: {
          id: string
          org_id: string
          trigger_type: 'datadog_webhook' | 'manual' | 'scheduled'
          trigger_payload: Json | null
          monitor_id: string | null
          monitor_name: string | null
          alert_name: string | null
          service: string | null
          environment: string
          severity: 'critical' | 'high' | 'medium' | 'low' | null
          status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at: string | null
          completed_at: string | null
          duration_ms: number | null
          summary: string | null
          root_cause: string | null
          confidence_score: number | null
          findings: Json
          suggested_actions: Json
          deployments_found: Json
          langsmith_run_id: string | null
          langsmith_url: string | null
          tool_calls: number
          feedback_rating: 'helpful' | 'not_helpful' | null
          feedback_comment: string | null
          feedback_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          trigger_type: 'datadog_webhook' | 'manual' | 'scheduled'
          trigger_payload?: Json | null
          monitor_id?: string | null
          monitor_name?: string | null
          alert_name?: string | null
          service?: string | null
          environment?: string
          severity?: 'critical' | 'high' | 'medium' | 'low' | null
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          summary?: string | null
          root_cause?: string | null
          confidence_score?: number | null
          findings?: Json
          suggested_actions?: Json
          deployments_found?: Json
          langsmith_run_id?: string | null
          langsmith_url?: string | null
          tool_calls?: number
          feedback_rating?: 'helpful' | 'not_helpful' | null
          feedback_comment?: string | null
          feedback_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          trigger_type?: 'datadog_webhook' | 'manual' | 'scheduled'
          trigger_payload?: Json | null
          monitor_id?: string | null
          monitor_name?: string | null
          alert_name?: string | null
          service?: string | null
          environment?: string
          severity?: 'critical' | 'high' | 'medium' | 'low' | null
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          started_at?: string | null
          completed_at?: string | null
          duration_ms?: number | null
          summary?: string | null
          root_cause?: string | null
          confidence_score?: number | null
          findings?: Json
          suggested_actions?: Json
          deployments_found?: Json
          langsmith_run_id?: string | null
          langsmith_url?: string | null
          tool_calls?: number
          feedback_rating?: 'helpful' | 'not_helpful' | null
          feedback_comment?: string | null
          feedback_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      investigation_events: {
        Row: {
          id: string
          investigation_id: string
          event_type: 'phase_change' | 'tool_call' | 'finding' | 'error' | 'hypothesis'
          event_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          investigation_id: string
          event_type: 'phase_change' | 'tool_call' | 'finding' | 'error' | 'hypothesis'
          event_data: Json
          created_at?: string
        }
        Update: {
          id?: string
          investigation_id?: string
          event_type?: 'phase_change' | 'tool_call' | 'finding' | 'error' | 'hypothesis'
          event_data?: Json
          created_at?: string
        }
      }
      webhook_logs: {
        Row: {
          id: string
          org_id: string | null
          source: string
          payload: Json | null
          headers: Json | null
          processed: boolean
          investigation_id: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          org_id?: string | null
          source: string
          payload?: Json | null
          headers?: Json | null
          processed?: boolean
          investigation_id?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string | null
          source?: string
          payload?: Json | null
          headers?: Json | null
          processed?: boolean
          investigation_id?: string | null
          error_message?: string | null
          created_at?: string
        }
      }
    }
    Functions: {
      get_user_org_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      is_org_member: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      is_org_admin: {
        Args: { check_org_id: string }
        Returns: boolean
      }
      store_integration_secret: {
        Args: {
          p_org_id: string
          p_provider: string
          p_secret_type: string
          p_secret_value: string
        }
        Returns: string
      }
      get_integration_secret: {
        Args: {
          p_org_id: string
          p_provider: string
          p_secret_type: string
        }
        Returns: string
      }
      delete_integration_secret: {
        Args: {
          p_org_id: string
          p_provider: string
          p_secret_type: string
        }
        Returns: boolean
      }
      get_org_credentials: {
        Args: { p_org_id: string }
        Returns: Json
      }
      get_current_user_profile: {
        Args: Record<string, never>
        Returns: Json
      }
      switch_organization: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      create_investigation: {
        Args: {
          p_org_id: string
          p_trigger_type: string
          p_trigger_payload?: Json
          p_alert_name?: string
          p_service?: string
          p_severity?: string
        }
        Returns: string
      }
      complete_investigation: {
        Args: {
          p_investigation_id: string
          p_status: string
          p_summary?: string
          p_root_cause?: string
          p_confidence_score?: number
          p_findings?: Json
          p_suggested_actions?: Json
          p_deployments_found?: Json
          p_tool_calls?: number
          p_langsmith_url?: string
        }
        Returns: boolean
      }
    }
  }
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Specific table types
export type Organization = Tables<'organizations'>
export type OrgMember = Tables<'org_members'>
export type Profile = Tables<'profiles'>
export type Integration = Tables<'integrations'>
export type Investigation = Tables<'investigations'>
export type InvestigationEvent = Tables<'investigation_events'>
export type WebhookLog = Tables<'webhook_logs'>
