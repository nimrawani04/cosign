export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agent_runs: {
        Row: {
          agent: string
          created_at: string
          duration_ms: number | null
          error: string | null
          id: string
          intent_id: string
          model: string | null
          output: Json | null
          proposal_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          agent: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          intent_id: string
          model?: string | null
          output?: Json | null
          proposal_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          agent?: string
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          id?: string
          intent_id?: string
          model?: string | null
          output?: Json | null
          proposal_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          id: string
          intent_id: string | null
          proposal_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          id?: string
          intent_id?: string | null
          proposal_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          id?: string
          intent_id?: string | null
          proposal_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      merchants: {
        Row: {
          created_at: string
          id: string
          is_simulated: boolean
          name: string
          notes: string | null
          rating: number
          slug: string
          trusted: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          name: string
          notes?: string | null
          rating?: number
          slug: string
          trusted?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          is_simulated?: boolean
          name?: string
          notes?: string | null
          rating?: number
          slug?: string
          trusted?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          intent_id: string
          is_sandbox: boolean
          paypal_capture_id: string | null
          paypal_order_id: string | null
          paypal_status: string | null
          proposal_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency: string
          id?: string
          intent_id: string
          is_sandbox?: boolean
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          paypal_status?: string | null
          proposal_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          intent_id?: string
          is_sandbox?: boolean
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          paypal_status?: string | null
          proposal_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: true
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          currency: string
          description: string
          fixture_type: string | null
          id: string
          merchant_id: string
          name: string
          price_minor: number
          return_days: number
          shipping_minor: number
          sku: string
          specs: Json
        }
        Insert: {
          category: string
          created_at?: string
          currency?: string
          description: string
          fixture_type?: string | null
          id?: string
          merchant_id: string
          name: string
          price_minor: number
          return_days?: number
          shipping_minor?: number
          sku: string
          specs?: Json
        }
        Update: {
          category?: string
          created_at?: string
          currency?: string
          description?: string
          fixture_type?: string | null
          id?: string
          merchant_id?: string
          name?: string
          price_minor?: number
          return_days?: number
          shipping_minor?: number
          sku?: string
          specs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          claimed: Json
          created_at: string
          currency: string
          eligible: boolean
          engine_checks: Json
          engine_decision: string | null
          guardian_decision: string | null
          guardian_risk: string | null
          guardian_summary: string | null
          id: string
          intent_id: string
          merchant_id: string
          pi_recommendation: string | null
          pi_risk: string | null
          pi_summary: string | null
          policy_id: string
          policy_version: number
          product_id: string
          quantity: number
          rank: number
          rationale: string | null
          shipping_minor: number
          status: string
          total_minor: number
          unit_price_minor: number
          user_id: string
        }
        Insert: {
          claimed?: Json
          created_at?: string
          currency: string
          eligible?: boolean
          engine_checks?: Json
          engine_decision?: string | null
          guardian_decision?: string | null
          guardian_risk?: string | null
          guardian_summary?: string | null
          id?: string
          intent_id: string
          merchant_id: string
          pi_recommendation?: string | null
          pi_risk?: string | null
          pi_summary?: string | null
          policy_id: string
          policy_version: number
          product_id: string
          quantity?: number
          rank?: number
          rationale?: string | null
          shipping_minor: number
          status?: string
          total_minor: number
          unit_price_minor: number
          user_id: string
        }
        Update: {
          claimed?: Json
          created_at?: string
          currency?: string
          eligible?: boolean
          engine_checks?: Json
          engine_decision?: string | null
          guardian_decision?: string | null
          guardian_risk?: string | null
          guardian_summary?: string | null
          id?: string
          intent_id?: string
          merchant_id?: string
          pi_recommendation?: string | null
          pi_risk?: string | null
          pi_summary?: string | null
          policy_id?: string
          policy_version?: number
          product_id?: string
          quantity?: number
          rank?: number
          rationale?: string | null
          shipping_minor?: number
          status?: string
          total_minor?: number
          unit_price_minor?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "purchase_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_intents: {
        Row: {
          clarifications: Json
          created_at: string
          current_policy_version: number | null
          draft_policy: Json | null
          fixture_type: string | null
          form_input: Json
          id: string
          is_simulation: boolean
          raw_request: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          clarifications?: Json
          created_at?: string
          current_policy_version?: number | null
          draft_policy?: Json | null
          fixture_type?: string | null
          form_input?: Json
          id?: string
          is_simulation?: boolean
          raw_request: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          clarifications?: Json
          created_at?: string
          current_policy_version?: number | null
          draft_policy?: Json | null
          fixture_type?: string | null
          form_input?: Json
          id?: string
          is_simulation?: boolean
          raw_request?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_policies: {
        Row: {
          created_at: string
          id: string
          intent_id: string
          policy: Json
          policy_hash: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          intent_id: string
          policy: Json
          policy_hash: string
          user_id: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          intent_id?: string
          policy?: Json
          policy_hash?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_policies_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          evidence: string | null
          explanation: string | null
          finding_type: string
          id: string
          intent_id: string
          proposal_id: string | null
          recommended_action: string | null
          severity: string
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          evidence?: string | null
          explanation?: string | null
          finding_type: string
          id?: string
          intent_id: string
          proposal_id?: string | null
          recommended_action?: string | null
          severity: string
          source: string
          user_id: string
        }
        Update: {
          created_at?: string
          evidence?: string | null
          explanation?: string | null
          finding_type?: string
          id?: string
          intent_id?: string
          proposal_id?: string | null
          recommended_action?: string | null
          severity?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_events_intent_id_fkey"
            columns: ["intent_id"]
            isOneToOne: false
            referencedRelation: "purchase_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          paypal_event_id: string
          resource_id: string | null
          verified: boolean
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          paypal_event_id: string
          resource_id?: string | null
          verified: boolean
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          paypal_event_id?: string
          resource_id?: string | null
          verified?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
