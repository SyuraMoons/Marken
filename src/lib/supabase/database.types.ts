// Generated from the live Supabase schema (project uadebrmaekqmvtoucalq). Do not edit by hand;
// regenerate after any migration in supabase/migrations/.

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
      media_uploads: {
        Row: {
          bytes: number
          created_at: string
          id: string
          mime_type: string | null
          shop_id: string
          storage_path: string
        }
        Insert: {
          bytes: number
          created_at?: string
          id?: string
          mime_type?: string | null
          shop_id: string
          storage_path: string
        }
        Update: {
          bytes?: number
          created_at?: string
          id?: string
          mime_type?: string | null
          shop_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_uploads_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      model_calls: {
        Row: {
          cache_hit: boolean
          cost_usd: number
          created_at: string
          fallback: boolean
          fallback_reason: string | null
          id: string
          images: number
          latency_ms: number
          model: string
          post_id: string | null
          provider: string | null
          requested_model: string | null
          retries: number
          shop_id: string | null
          step: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          cache_hit?: boolean
          cost_usd?: number
          created_at?: string
          fallback?: boolean
          fallback_reason?: string | null
          id: string
          images?: number
          latency_ms?: number
          model: string
          post_id?: string | null
          provider?: string | null
          requested_model?: string | null
          retries?: number
          shop_id?: string | null
          step: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          cache_hit?: boolean
          cost_usd?: number
          created_at?: string
          fallback?: boolean
          fallback_reason?: string | null
          id?: string
          images?: number
          latency_ms?: number
          model?: string
          post_id?: string | null
          provider?: string | null
          requested_model?: string | null
          retries?: number
          shop_id?: string | null
          step?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: [
          {
            foreignKeyName: "model_calls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_calls_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_events: {
        Row: {
          finished_at: string | null
          id: string
          shop_id: string
          skipped: boolean
          started_at: string
          step: number
        }
        Insert: {
          finished_at?: string | null
          id?: string
          shop_id: string
          skipped?: boolean
          started_at?: string
          step: number
        }
        Update: {
          finished_at?: string | null
          id?: string
          shop_id?: string
          skipped?: boolean
          started_at?: string
          step?: number
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      post_revisions: {
        Row: {
          created_at: string
          feedback: string | null
          id: string
          output: Json | null
          post_id: string
          target: string
        }
        Insert: {
          created_at?: string
          feedback?: string | null
          id?: string
          output?: Json | null
          post_id: string
          target: string
        }
        Update: {
          created_at?: string
          feedback?: string | null
          id?: string
          output?: Json | null
          post_id?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_revisions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_steps: {
        Row: {
          detail: Json | null
          finished_at: string | null
          id: string
          model: string | null
          post_id: string
          shop_id: string
          started_at: string
          status: string
          step: string
        }
        Insert: {
          detail?: Json | null
          finished_at?: string | null
          id?: string
          model?: string | null
          post_id: string
          shop_id: string
          started_at?: string
          status?: string
          step: string
        }
        Update: {
          detail?: Json | null
          finished_at?: string | null
          id?: string
          model?: string | null
          post_id?: string
          shop_id?: string
          started_at?: string
          status?: string
          step?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_steps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_steps_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          approved_at: string | null
          caption_options: Json
          chosen_caption: string | null
          created_at: string
          fit_reason: string | null
          hashtags: string[]
          id: string
          ig_media_id: string | null
          permalink: string | null
          post_date: string
          product_id: string | null
          published_at: string | null
          shop_id: string
          skip_reason: string | null
          slides: Json
          status: string
          trend_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          caption_options?: Json
          chosen_caption?: string | null
          created_at?: string
          fit_reason?: string | null
          hashtags?: string[]
          id?: string
          ig_media_id?: string | null
          permalink?: string | null
          post_date: string
          product_id?: string | null
          published_at?: string | null
          shop_id: string
          skip_reason?: string | null
          slides?: Json
          status?: string
          trend_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          caption_options?: Json
          chosen_caption?: string | null
          created_at?: string
          fit_reason?: string | null
          hashtags?: string[]
          id?: string
          ig_media_id?: string | null
          permalink?: string | null
          post_date?: string
          product_id?: string | null
          published_at?: string | null
          shop_id?: string
          skip_reason?: string | null
          slides?: Json
          status?: string
          trend_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json
          category: string | null
          created_at: string
          currency: string | null
          cutout_confirmed: boolean
          cutout_path: string | null
          description: string | null
          hidden: boolean
          id: string
          name: string
          price: number | null
          shop_id: string
          source_upload_id: string | null
          updated_at: string
        }
        Insert: {
          attributes?: Json
          category?: string | null
          created_at?: string
          currency?: string | null
          cutout_confirmed?: boolean
          cutout_path?: string | null
          description?: string | null
          hidden?: boolean
          id?: string
          name: string
          price?: number | null
          shop_id: string
          source_upload_id?: string | null
          updated_at?: string
        }
        Update: {
          attributes?: Json
          category?: string | null
          created_at?: string
          currency?: string | null
          cutout_confirmed?: boolean
          cutout_path?: string | null
          description?: string | null
          hidden?: boolean
          id?: string
          name?: string
          price?: number | null
          shop_id?: string
          source_upload_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_source_upload_id_fkey"
            columns: ["source_upload_id"]
            isOneToOne: false
            referencedRelation: "media_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_secrets: {
        Row: {
          ig_token_encrypted: string | null
          ig_token_expires_at: string | null
          shop_id: string
          updated_at: string
        }
        Insert: {
          ig_token_encrypted?: string | null
          ig_token_expires_at?: string | null
          shop_id: string
          updated_at?: string
        }
        Update: {
          ig_token_encrypted?: string | null
          ig_token_expires_at?: string | null
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_secrets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          category: string | null
          content_language: string
          country: string | null
          created_at: string
          id: string
          ig_account_id: string | null
          name: string | null
          notify_time: string
          onboarding_completed_at: string | null
          onboarding_step: number
          owner_id: string
          time_zone: string | null
          tone: string | null
          tour_completed_at: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          content_language?: string
          country?: string | null
          created_at?: string
          id?: string
          ig_account_id?: string | null
          name?: string | null
          notify_time?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          owner_id: string
          time_zone?: string | null
          tone?: string | null
          tour_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          content_language?: string
          country?: string | null
          created_at?: string
          id?: string
          ig_account_id?: string | null
          name?: string | null
          notify_time?: string
          onboarding_completed_at?: string | null
          onboarding_step?: number
          owner_id?: string
          time_zone?: string | null
          tone?: string | null
          tour_completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shops_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      style_rules: {
        Row: {
          id: string
          position: number
          shop_id: string
          text: string
        }
        Insert: {
          id?: string
          position: number
          shop_id: string
          text: string
        }
        Update: {
          id?: string
          position?: number
          shop_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "style_rules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_analyses: {
        Row: {
          created_at: string
          expires_at: string
          from_video: boolean
          hook: string | null
          model: string | null
          scene_brief: string | null
          structure: string | null
          trend_id: string
          visual_style: string | null
          why_it_works: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          from_video?: boolean
          hook?: string | null
          model?: string | null
          scene_brief?: string | null
          structure?: string | null
          trend_id: string
          visual_style?: string | null
          why_it_works?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          from_video?: boolean
          hook?: string | null
          model?: string | null
          scene_brief?: string | null
          structure?: string | null
          trend_id?: string
          visual_style?: string | null
          why_it_works?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trend_analyses_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: true
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          category: string
          collected_at: string
          country: string
          id: string
          score: number | null
          source: string
          source_rank: number | null
          title: string
          type: string | null
          url: string | null
        }
        Insert: {
          category?: string
          collected_at?: string
          country?: string
          id?: string
          score?: number | null
          source: string
          source_rank?: number | null
          title: string
          type?: string | null
          url?: string | null
        }
        Update: {
          category?: string
          collected_at?: string
          country?: string
          id?: string
          score?: number | null
          source?: string
          source_rank?: number | null
          title?: string
          type?: string | null
          url?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string | null
          ui_locale: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
          ui_locale?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          ui_locale?: string
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
