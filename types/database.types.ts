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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      board_card_messages: {
        Row: {
          card_id: string
          created_at: string | null
          encrypted_payload: string
          id: string
          message_type: string
          sender_id: string
        }
        Insert: {
          card_id: string
          created_at?: string | null
          encrypted_payload: string
          id?: string
          message_type: string
          sender_id: string
        }
        Update: {
          card_id?: string
          created_at?: string | null
          encrypted_payload?: string
          id?: string
          message_type?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_card_messages_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "board_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      board_cards: {
        Row: {
          author_id: string
          author_ready: boolean
          column: Database["public"]["Enums"]["board_column_enum"]
          created_at: string | null
          encrypted_author_perspective: string | null
          encrypted_partner_perspective: string | null
          encrypted_text: string
          encrypted_voice_note: string | null
          id: string
          mood_tag: string | null
          partner_acknowledged: boolean
          partner_ready: boolean
          position: number
          resolved_at: string | null
          space_id: string
        }
        Insert: {
          author_id: string
          author_ready?: boolean
          column?: Database["public"]["Enums"]["board_column_enum"]
          created_at?: string | null
          encrypted_author_perspective?: string | null
          encrypted_partner_perspective?: string | null
          encrypted_text: string
          encrypted_voice_note?: string | null
          id?: string
          mood_tag?: string | null
          partner_acknowledged?: boolean
          partner_ready?: boolean
          position?: number
          resolved_at?: string | null
          space_id: string
        }
        Update: {
          author_id?: string
          author_ready?: boolean
          column?: Database["public"]["Enums"]["board_column_enum"]
          created_at?: string | null
          encrypted_author_perspective?: string | null
          encrypted_partner_perspective?: string | null
          encrypted_text?: string
          encrypted_voice_note?: string | null
          id?: string
          mood_tag?: string | null
          partner_acknowledged?: boolean
          partner_ready?: boolean
          position?: number
          resolved_at?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_cards_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_items: {
        Row: {
          budget_cents: number | null
          category: string | null
          completed_at: string | null
          completion_a: Json | null
          completion_b: Json | null
          created_at: string
          creator_id: string
          encrypted_why: string
          hype_votes: Json
          id: string
          saved_cents: number
          space_id: string
          status: Database["public"]["Enums"]["bucket_status_enum"]
          target_date: string | null
          title: string
          vibe_rating_a: number | null
          vibe_rating_b: number | null
        }
        Insert: {
          budget_cents?: number | null
          category?: string | null
          completed_at?: string | null
          completion_a?: Json | null
          completion_b?: Json | null
          created_at?: string
          creator_id: string
          encrypted_why: string
          hype_votes?: Json
          id?: string
          saved_cents?: number
          space_id: string
          status?: Database["public"]["Enums"]["bucket_status_enum"]
          target_date?: string | null
          title: string
          vibe_rating_a?: number | null
          vibe_rating_b?: number | null
        }
        Update: {
          budget_cents?: number | null
          category?: string | null
          completed_at?: string | null
          completion_a?: Json | null
          completion_b?: Json | null
          created_at?: string
          creator_id?: string
          encrypted_why?: string
          hype_votes?: Json
          id?: string
          saved_cents?: number
          space_id?: string
          status?: Database["public"]["Enums"]["bucket_status_enum"]
          target_date?: string | null
          title?: string
          vibe_rating_a?: number | null
          vibe_rating_b?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bucket_items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_media: {
        Row: {
          bucket_item_id: string
          created_at: string
          id: string
          media_type: string
          space_id: string
          url_or_content: string
          user_id: string
        }
        Insert: {
          bucket_item_id: string
          created_at?: string
          id?: string
          media_type: string
          space_id: string
          url_or_content: string
          user_id: string
        }
        Update: {
          bucket_item_id?: string
          created_at?: string
          id?: string
          media_type?: string
          space_id?: string
          url_or_content?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_media_bucket_item_id_fkey"
            columns: ["bucket_item_id"]
            isOneToOne: false
            referencedRelation: "bucket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bucket_media_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bucket_todos: {
        Row: {
          assigned_to: string | null
          bucket_item_id: string
          created_at: string
          creator_id: string
          encrypted_text: string
          id: string
          is_completed: boolean
          space_id: string
        }
        Insert: {
          assigned_to?: string | null
          bucket_item_id: string
          created_at?: string
          creator_id: string
          encrypted_text: string
          id?: string
          is_completed?: boolean
          space_id: string
        }
        Update: {
          assigned_to?: string | null
          bucket_item_id?: string
          created_at?: string
          creator_id?: string
          encrypted_text?: string
          id?: string
          is_completed?: boolean
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bucket_todos_bucket_item_id_fkey"
            columns: ["bucket_item_id"]
            isOneToOne: false
            referencedRelation: "bucket_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bucket_todos_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      capture_events: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          initiator_id: string
          is_paired: boolean
          partner_joined: boolean
          photo_a_url: string | null
          photo_b_url: string | null
          shutter_clicked_at: string | null
          space_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          initiator_id: string
          is_paired?: boolean
          partner_joined?: boolean
          photo_a_url?: string | null
          photo_b_url?: string | null
          shutter_clicked_at?: string | null
          space_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          initiator_id?: string
          is_paired?: boolean
          partner_joined?: boolean
          photo_a_url?: string | null
          photo_b_url?: string | null
          shutter_clicked_at?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dictionary_entries: {
        Row: {
          author_id: string
          created_at: string
          delete_requested_by: string | null
          encrypted_meaning: string
          encrypted_origin: string | null
          encrypted_word: string
          id: string
          space_id: string
        }
        Insert: {
          author_id: string
          created_at?: string
          delete_requested_by?: string | null
          encrypted_meaning: string
          encrypted_origin?: string | null
          encrypted_word: string
          id?: string
          space_id: string
        }
        Update: {
          author_id?: string
          created_at?: string
          delete_requested_by?: string | null
          encrypted_meaning?: string
          encrypted_origin?: string | null
          encrypted_word?: string
          id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dictionary_entries_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_questions: {
        Row: {
          date: string
          id: string
          question_text: string
          space_id: string
        }
        Insert: {
          date?: string
          id?: string
          question_text: string
          space_id: string
        }
        Update: {
          date?: string
          id?: string
          question_text?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_questions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      energy_logs: {
        Row: {
          date: string
          id: string
          morning_level: number | null
          night_level: number | null
          space_id: string
          user_id: string
        }
        Insert: {
          date?: string
          id?: string
          morning_level?: number | null
          night_level?: number | null
          space_id: string
          user_id: string
        }
        Update: {
          date?: string
          id?: string
          morning_level?: number | null
          night_level?: number | null
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "energy_logs_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_events: {
        Row: {
          author_id: string
          created_at: string | null
          delete_requested_by: string | null
          encrypted_caption: string | null
          id: string
          is_pinned: boolean | null
          media_url: string | null
          metadata: Json | null
          space_id: string
          type: Database["public"]["Enums"]["feed_event_type"]
        }
        Insert: {
          author_id: string
          created_at?: string | null
          delete_requested_by?: string | null
          encrypted_caption?: string | null
          id?: string
          is_pinned?: boolean | null
          media_url?: string | null
          metadata?: Json | null
          space_id: string
          type: Database["public"]["Enums"]["feed_event_type"]
        }
        Update: {
          author_id?: string
          created_at?: string | null
          delete_requested_by?: string | null
          encrypted_caption?: string | null
          id?: string
          is_pinned?: boolean | null
          media_url?: string | null
          metadata?: Json | null
          space_id?: string
          type?: Database["public"]["Enums"]["feed_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "feed_events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          charged_id: string
          charger_id: string
          created_at: string | null
          encrypted_note: string | null
          forgiveness_requested: boolean
          forgiveness_requested_at: string | null
          id: string
          is_settled: boolean
          is_vetoed: boolean | null
          rule_id: string
          settled_at: string | null
          space_id: string
        }
        Insert: {
          charged_id: string
          charger_id: string
          created_at?: string | null
          encrypted_note?: string | null
          forgiveness_requested?: boolean
          forgiveness_requested_at?: string | null
          id?: string
          is_settled?: boolean
          is_vetoed?: boolean | null
          rule_id: string
          settled_at?: string | null
          space_id: string
        }
        Update: {
          charged_id?: string
          charger_id?: string
          created_at?: string | null
          encrypted_note?: string | null
          forgiveness_requested?: boolean
          forgiveness_requested_at?: string | null
          id?: string
          is_settled?: boolean
          is_vetoed?: boolean | null
          rule_id?: string
          settled_at?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      newspaper_archives: {
        Row: {
          encrypted_html_snapshot: string
          id: string
          published_date: string
          space_id: string
          stats_snapshot: Json
        }
        Insert: {
          encrypted_html_snapshot: string
          id?: string
          published_date: string
          space_id: string
          stats_snapshot: Json
        }
        Update: {
          encrypted_html_snapshot?: string
          id?: string
          published_date?: string
          space_id?: string
          stats_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "newspaper_archives_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          id: string
          sent_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          id?: string
          sent_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          id?: string
          sent_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      question_responses: {
        Row: {
          date: string
          encrypted_answer: string
          id: string
          question_id: string
          space_id: string
          user_id: string
        }
        Insert: {
          date?: string
          encrypted_answer: string
          id?: string
          question_id: string
          space_id: string
          user_id: string
        }
        Update: {
          date?: string
          encrypted_answer?: string
          id?: string
          question_id?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_responses_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          display_order: number
          id: string
          question_text: string
        }
        Insert: {
          display_order: number
          id?: string
          question_text: string
        }
        Update: {
          display_order?: number
          id?: string
          question_text?: string
        }
        Relationships: []
      }
      rules: {
        Row: {
          accepted_at: string | null
          author_id: string
          category: string
          created_at: string | null
          encrypted_penalty: string | null
          encrypted_text: string
          id: string
          space_id: string
          status: Database["public"]["Enums"]["rule_status_enum"]
        }
        Insert: {
          accepted_at?: string | null
          author_id: string
          category?: string
          created_at?: string | null
          encrypted_penalty?: string | null
          encrypted_text: string
          id?: string
          space_id: string
          status?: Database["public"]["Enums"]["rule_status_enum"]
        }
        Update: {
          accepted_at?: string | null
          author_id?: string
          category?: string
          created_at?: string | null
          encrypted_penalty?: string | null
          encrypted_text?: string
          id?: string
          space_id?: string
          status?: Database["public"]["Enums"]["rule_status_enum"]
        }
        Relationships: [
          {
            foreignKeyName: "rules_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      skip_requests: {
        Row: {
          created_at: string | null
          id: string
          reason: string | null
          requester_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["skip_status_enum"] | null
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason?: string | null
          requester_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["skip_status_enum"] | null
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string | null
          requester_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["skip_status_enum"] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skip_requests_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          created_at: string | null
          encrypted_test_payload: string | null
          id: string
          invite_code: string
          is_active: boolean | null
          severed_at: string | null
          space_name: string | null
          user_names: string[]
          users: string[]
        }
        Insert: {
          created_at?: string | null
          encrypted_test_payload?: string | null
          id?: string
          invite_code: string
          is_active?: boolean | null
          severed_at?: string | null
          space_name?: string | null
          user_names?: string[]
          users?: string[]
        }
        Update: {
          created_at?: string | null
          encrypted_test_payload?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean | null
          severed_at?: string | null
          space_name?: string | null
          user_names?: string[]
          users?: string[]
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          completed_at: string | null
          completed_by: string
          id: string
          is_flagged: boolean | null
          mood_tag: Database["public"]["Enums"]["mood_tag_enum"]
          photo_path: string | null
          streak_at_completion: number
          task_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by: string
          id?: string
          is_flagged?: boolean | null
          mood_tag: Database["public"]["Enums"]["mood_tag_enum"]
          photo_path?: string | null
          streak_at_completion: number
          task_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string
          id?: string
          is_flagged?: boolean | null
          mood_tag?: Database["public"]["Enums"]["mood_tag_enum"]
          photo_path?: string | null
          streak_at_completion?: number
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_coop: boolean | null
          last_completed_at: string | null
          owner_id: string
          partner_streak_count: number | null
          photo_proofs_count: number | null
          shared_streak_count: number | null
          space_id: string
          streak_count: number | null
          streak_freezes: number | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_coop?: boolean | null
          last_completed_at?: string | null
          owner_id: string
          partner_streak_count?: number | null
          photo_proofs_count?: number | null
          shared_streak_count?: number | null
          space_id: string
          streak_count?: number | null
          streak_freezes?: number | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_coop?: boolean | null
          last_completed_at?: string | null
          owner_id?: string
          partner_streak_count?: number | null
          photo_proofs_count?: number | null
          shared_streak_count?: number | null
          space_id?: string
          streak_count?: number | null
          streak_freezes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_stats: {
        Row: {
          captures_count: number | null
          focus_minutes: number | null
          id: string
          photos_count: number | null
          rules_broken_count: number | null
          space_id: string
          tasks_done_count: number | null
          watch_sessions_count: number | null
          week_start: string
        }
        Insert: {
          captures_count?: number | null
          focus_minutes?: number | null
          id?: string
          photos_count?: number | null
          rules_broken_count?: number | null
          space_id: string
          tasks_done_count?: number | null
          watch_sessions_count?: number | null
          week_start: string
        }
        Update: {
          captures_count?: number | null
          focus_minutes?: number | null
          id?: string
          photos_count?: number | null
          rules_broken_count?: number | null
          space_id?: string
          tasks_done_count?: number | null
          watch_sessions_count?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_stats_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_old_resolved_cards: { Args: never; Returns: undefined }
      auto_approve_pending_skips: { Args: never; Returns: undefined }
      cleanup_severed_spaces: { Args: never; Returns: undefined }
      join_space: {
        Args: { p_invite_code: string; p_user_id: string; p_user_name: string }
        Returns: string
      }
    }
    Enums: {
      board_column_enum: "on_my_mind" | "lets_talk" | "resolved"
      bucket_status_enum: "someday" | "planning" | "done"
      feed_event_type:
        | "photo"
        | "note"
        | "task_done"
        | "mood"
        | "watch_session"
        | "focus_session"
        | "capture"
      mood_tag_enum: "easy" | "struggled" | "forced" | "proud"
      rule_status_enum: "proposed" | "active" | "retired"
      skip_status_enum: "pending" | "approved" | "denied"
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
    Enums: {
      board_column_enum: ["on_my_mind", "lets_talk", "resolved"],
      bucket_status_enum: ["someday", "planning", "done"],
      feed_event_type: [
        "photo",
        "note",
        "task_done",
        "mood",
        "watch_session",
        "focus_session",
        "capture",
      ],
      mood_tag_enum: ["easy", "struggled", "forced", "proud"],
      rule_status_enum: ["proposed", "active", "retired"],
      skip_status_enum: ["pending", "approved", "denied"],
    },
  },
} as const
