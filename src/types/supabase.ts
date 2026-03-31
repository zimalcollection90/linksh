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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      click_events: {
        Row: {
          browser: string | null
          city: string | null
          clicked_at: string | null
          country: string | null
          country_code: string | null
          device_type: string | null
          filter_reason: string | null
          id: string
          ip_address: string | null
          is_bot: boolean | null
          is_filtered: boolean | null
          is_unique: boolean | null
          link_id: string
          os: string | null
          quality_score: number | null
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          clicked_at?: string | null
          country?: string | null
          country_code?: string | null
          device_type?: string | null
          filter_reason?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean | null
          is_filtered?: boolean | null
          is_unique?: boolean | null
          link_id: string
          os?: string | null
          quality_score?: number | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          clicked_at?: string | null
          country?: string | null
          country_code?: string | null
          device_type?: string | null
          filter_reason?: string | null
          id?: string
          ip_address?: string | null
          is_bot?: boolean | null
          is_filtered?: boolean | null
          is_unique?: boolean | null
          link_id?: string
          os?: string | null
          quality_score?: number | null
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "click_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "click_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number | null
          clicks: number | null
          created_at: string | null
          id: string
          link_id: string | null
          paid_at: string | null
          payment_status: string | null
          period_end: string | null
          period_start: string | null
          rate: number | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          clicks?: number | null
          created_at?: string | null
          id?: string
          link_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          period_end?: string | null
          period_start?: string | null
          rate?: number | null
          user_id: string
        }
        Update: {
          amount?: number | null
          clicks?: number | null
          created_at?: string | null
          id?: string
          link_id?: string | null
          paid_at?: string | null
          payment_status?: string | null
          period_end?: string | null
          period_start?: string | null
          rate?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          id: string
          period: string | null
          target_clicks: number | null
          target_earnings: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          period?: string | null
          target_clicks?: number | null
          target_earnings?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          period?: string | null
          target_clicks?: number | null
          target_earnings?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string
          role: string | null
          status: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by: string
          role?: string | null
          status?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          role?: string | null
          status?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_exclusions: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address: string
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ip_exclusions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      links: {
        Row: {
          campaign_id: string | null
          click_count: number | null
          created_at: string | null
          destination_url: string
          expires_at: string | null
          fraud_score: number | null
          id: string
          is_fraud_flagged: boolean | null
          is_password_protected: boolean | null
          password_hash: string | null
          short_code: string
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number | null
          created_at?: string | null
          destination_url: string
          expires_at?: string | null
          fraud_score?: number | null
          id?: string
          is_fraud_flagged?: boolean | null
          is_password_protected?: boolean | null
          password_hash?: string | null
          short_code: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          campaign_id?: string | null
          click_count?: number | null
          created_at?: string | null
          destination_url?: string
          expires_at?: string | null
          fraud_score?: number | null
          id?: string
          is_fraud_flagged?: boolean | null
          is_password_protected?: boolean | null
          password_hash?: string | null
          short_code?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_links_campaign"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          earnings_rate: number | null
          email: string | null
          full_name: string | null
          id: string
          image: string | null
          last_active_at: string | null
          last_seen_ip: string | null
          name: string | null
          role: string | null
          status: string | null
          theme: string | null
          token_identifier: string
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          earnings_rate?: number | null
          email?: string | null
          full_name?: string | null
          id: string
          image?: string | null
          last_active_at?: string | null
          last_seen_ip?: string | null
          name?: string | null
          role?: string | null
          status?: string | null
          theme?: string | null
          token_identifier: string
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          earnings_rate?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          image?: string | null
          last_active_at?: string | null
          last_seen_ip?: string | null
          name?: string | null
          role?: string | null
          status?: string | null
          theme?: string | null
          token_identifier?: string
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_company_click_stats: {
        Args: { p_company_id: string }
        Returns: {
          bot_excluded: number
          filtered_clicks: number
          real_clicks: number
          total_clicks: number
          unique_users: number
        }[]
      }
      get_member_stats_for_company: {
        Args: { p_company_id: string }
        Returns: {
          bot_excluded: number
          filtered_clicks: number
          link_count: number
          real_clicks: number
          total_clicks: number
          unique_users: number
          user_id: string
        }[]
      }
      get_user_click_stats: {
        Args: { p_user_id: string }
        Returns: {
          bot_excluded: number
          filtered_clicks: number
          real_clicks: number
          total_clicks: number
          unique_users: number
        }[]
      }
      get_user_daily_clicks: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          bots: number
          day: string
          real_clicks: number
          total: number
          unique_users: number
        }[]
      }
      increment_link_clicks: { Args: { link_id: string }; Returns: undefined }
      resolve_link_and_log_click: {
        Args: {
          p_browser: string
          p_code: string
          p_device_type: string
          p_ip: string
          p_os: string
          p_password?: string
          p_referrer: string
          p_user_agent: string
        }
        Returns: {
          click_event_id: string
          destination_url: string
          requires_password: boolean
        }[]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
