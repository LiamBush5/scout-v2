export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      integrations: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          created_at: string | null
          error_message: string | null
          id: string
          last_verified_at: string | null
          metadata: Json | null
          org_id: string
          provider: 'datadog' | 'github' | 'slack' | 'pagerduty'
          status: 'connected' | 'disconnected' | 'error'
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json | null
          org_id: string
          provider: 'datadog' | 'github' | 'slack' | 'pagerduty'
          status?: 'connected' | 'disconnected' | 'error'
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_verified_at?: string | null
          metadata?: Json | null
          org_id?: string
          provider?: 'datadog' | 'github' | 'slack' | 'pagerduty'
          status?: 'connected' | 'disconnected' | 'error'
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'integrations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      investigation_events: {
        Row: {
          created_at: string | null
          event_data: Json
          event_type: 'phase_change' | 'tool_call' | 'finding' | 'error' | 'hypothesis'
          id: string
          investigation_id: string
        }
        Insert: {
          created_at?: string | null
          event_data: Json
          event_type: 'phase_change' | 'tool_call' | 'finding' | 'error' | 'hypothesis'
          id?: string
          investigation_id: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json
          event_type?: 'phase_change' | 'tool_call' | 'finding' | 'error' | 'hypothesis'
          id?: string
          investigation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'investigation_events_investigation_id_fkey'
            columns: ['investigation_id']
            isOneToOne: false
            referencedRelation: 'investigations'
            referencedColumns: ['id']
          }
        ]
      }
      investigations: {
        Row: {
          alert_name: string | null
          completed_at: string | null
          confidence_score: number | null
          created_at: string | null
          deployments_found: Json | null
          duration_ms: number | null
          environment: string | null
          feedback_at: string | null
          feedback_comment: string | null
          feedback_rating: 'helpful' | 'not_helpful' | null
          findings: Json | null
          id: string
          langsmith_run_id: string | null
          langsmith_url: string | null
          monitor_id: string | null
          monitor_name: string | null
          org_id: string
          root_cause: string | null
          service: string | null
          severity: 'critical' | 'high' | 'medium' | 'low' | null
          started_at: string | null
          status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          suggested_actions: Json | null
          summary: string | null
          tool_calls: number | null
          trigger_payload: Json | null
          trigger_type: 'datadog_webhook' | 'manual' | 'scheduled'
          updated_at: string | null
        }
        Insert: {
          alert_name?: string | null
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          deployments_found?: Json | null
          duration_ms?: number | null
          environment?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: 'helpful' | 'not_helpful' | null
          findings?: Json | null
          id?: string
          langsmith_run_id?: string | null
          langsmith_url?: string | null
          monitor_id?: string | null
          monitor_name?: string | null
          org_id: string
          root_cause?: string | null
          service?: string | null
          severity?: 'critical' | 'high' | 'medium' | 'low' | null
          started_at?: string | null
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          suggested_actions?: Json | null
          summary?: string | null
          tool_calls?: number | null
          trigger_payload?: Json | null
          trigger_type: 'datadog_webhook' | 'manual' | 'scheduled'
          updated_at?: string | null
        }
        Update: {
          alert_name?: string | null
          completed_at?: string | null
          confidence_score?: number | null
          created_at?: string | null
          deployments_found?: Json | null
          duration_ms?: number | null
          environment?: string | null
          feedback_at?: string | null
          feedback_comment?: string | null
          feedback_rating?: 'helpful' | 'not_helpful' | null
          findings?: Json | null
          id?: string
          langsmith_run_id?: string | null
          langsmith_url?: string | null
          monitor_id?: string | null
          monitor_name?: string | null
          org_id?: string
          root_cause?: string | null
          service?: string | null
          severity?: 'critical' | 'high' | 'medium' | 'low' | null
          started_at?: string | null
          status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
          suggested_actions?: Json | null
          summary?: string | null
          tool_calls?: number | null
          trigger_payload?: Json | null
          trigger_type?: 'datadog_webhook' | 'manual' | 'scheduled'
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'investigations_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      org_members: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          org_id: string
          role: 'owner' | 'admin' | 'member'
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          org_id: string
          role?: 'owner' | 'admin' | 'member'
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          org_id?: string
          role?: 'owner' | 'admin' | 'member'
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'org_members_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_org_id: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarding_step: number | null
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarding_step?: number | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_org_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarding_step?: number | null
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_current_org_id_fkey'
            columns: ['current_org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
      webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          headers: Json | null
          id: string
          investigation_id: string | null
          org_id: string | null
          payload: Json | null
          processed: boolean | null
          source: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          investigation_id?: string | null
          org_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          source: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          headers?: Json | null
          id?: string
          investigation_id?: string | null
          org_id?: string | null
          payload?: Json | null
          processed?: boolean | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: 'webhook_logs_investigation_id_fkey'
            columns: ['investigation_id']
            isOneToOne: false
            referencedRelation: 'investigations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'webhook_logs_org_id_fkey'
            columns: ['org_id']
            isOneToOne: false
            referencedRelation: 'organizations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      delete_integration_secret: {
        Args: {
          p_org_id: string
          p_provider: string
          p_secret_type: string
        }
        Returns: boolean
      }
      get_current_user_profile: {
        Args: Record<string, never>
        Returns: Json
      }
      get_integration_secret: {
        Args: {
          p_org_id: string
          p_provider: string
          p_secret_type: string
        }
        Returns: string
      }
      get_org_credentials: {
        Args: {
          p_org_id: string
        }
        Returns: Json
      }
      get_user_org_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      is_org_admin: {
        Args: {
          check_org_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: {
          check_org_id: string
        }
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
      switch_organization: {
        Args: {
          p_org_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Convenience types
export type Organization = Tables<'organizations'>
export type OrgMember = Tables<'org_members'>
export type Profile = Tables<'profiles'>
export type Integration = Tables<'integrations'>
export type Investigation = Tables<'investigations'>
export type InvestigationEvent = Tables<'investigation_events'>
export type WebhookLog = Tables<'webhook_logs'>

// Provider types
export type IntegrationProvider = 'datadog' | 'github' | 'slack' | 'pagerduty'
export type IntegrationStatus = 'connected' | 'disconnected' | 'error'
export type InvestigationStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type OrgRole = 'owner' | 'admin' | 'member'
