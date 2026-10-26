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
      access_codes: {
        Row: {
          claimed_at: string | null
          code_hash: string
          created_at: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          code_hash: string
          created_at?: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          code_hash?: string
          created_at?: string
          purpose?: string
          user_id?: string | null
        }
        Relationships: []
      }
      account_limits: {
        Row: {
          games: number
          user_id: string
        }
        Insert: {
          games: number
          user_id: string
        }
        Update: {
          games?: number
          user_id?: string
        }
        Relationships: []
      }
      book_reviews: {
        Row: {
          body: string | null
          book_id: string
          created_at: string
          hidden: boolean
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          book_id: string
          created_at?: string
          hidden?: boolean
          stars: number
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          book_id?: string
          created_at?: string
          hidden?: boolean
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "store_books"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "book_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_saves: {
        Row: {
          book_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_saves_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "store_books"
            referencedColumns: ["book_id"]
          },
          {
            foreignKeyName: "book_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drill_attempts: {
        Row: {
          attempted_at: string
          drill_id: string
          id: string
          moves_played: string[]
          succeeded: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          drill_id: string
          id?: string
          moves_played?: string[]
          succeeded: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          drill_id?: string
          id?: string
          moves_played?: string[]
          succeeded?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_attempts_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drill_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drills: {
        Row: {
          book_id: string
          difficulty_score: number
          end_position_key: string
          eval_drop_cp: number
          generated_at: string
          id: string
          mistake_depth: number
          mistake_move_uci: string
          punishment_line_uci: string[]
          start_position_key: string
          user_id: string
        }
        Insert: {
          book_id: string
          difficulty_score?: number
          end_position_key: string
          eval_drop_cp: number
          generated_at?: string
          id?: string
          mistake_depth: number
          mistake_move_uci: string
          punishment_line_uci?: string[]
          start_position_key: string
          user_id: string
        }
        Update: {
          book_id?: string
          difficulty_score?: number
          end_position_key?: string
          eval_drop_cp?: number
          generated_at?: string
          id?: string
          mistake_depth?: number
          mistake_move_uci?: string
          punishment_line_uci?: string[]
          start_position_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drills_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "opening_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drills_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_history: {
        Row: {
          chunks: Json
          games: number
          imports: Json
          last_import_at: string | null
          user_id: string
          username: string | null
          version: number
        }
        Insert: {
          chunks?: Json
          games?: number
          imports?: Json
          last_import_at?: string | null
          user_id: string
          username?: string | null
          version?: number
        }
        Update: {
          chunks?: Json
          games?: number
          imports?: Json
          last_import_at?: string | null
          user_id?: string
          username?: string | null
          version?: number
        }
        Relationships: []
      }
      game_history_chunks: {
        Row: {
          clocks: Json
          game_count: number
          games: Json
          n: number
          user_id: string
          version: number
        }
        Insert: {
          clocks: Json
          game_count: number
          games: Json
          n: number
          user_id: string
          version: number
        }
        Update: {
          clocks?: Json
          game_count?: number
          games?: Json
          n?: number
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      game_history_staged: {
        Row: {
          base_version: number
          clocks: Json
          game_count: number
          games: Json
          import_ids: number[]
          n: number
          staged_at: string
          user_id: string
        }
        Insert: {
          base_version: number
          clocks: Json
          game_count: number
          games: Json
          import_ids: number[]
          n: number
          staged_at?: string
          user_id: string
        }
        Update: {
          base_version?: number
          clocks?: Json
          game_count?: number
          games?: Json
          import_ids?: number[]
          n?: number
          staged_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_limit_requests: {
        Row: {
          answered_at: string | null
          created_at: string
          games: number
          id: number
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          answered_at?: string | null
          created_at?: string
          games: number
          id?: never
          reason?: string
          status?: string
          user_id: string
        }
        Update: {
          answered_at?: string | null
          created_at?: string
          games?: number
          id?: never
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      opening_books: {
        Row: {
          color: string
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          origin: Json
          publisher_difficulty: number | null
          summary: Json
          trees: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          origin?: Json
          publisher_difficulty?: number | null
          summary: Json
          trees: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          origin?: Json
          publisher_difficulty?: number | null
          summary?: Json
          trees?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opening_books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      position_cache: {
        Row: {
          cached_at: string | null
          explorer_data: Json
          position_key: string
        }
        Insert: {
          cached_at?: string | null
          explorer_data: Json
          position_key: string
        }
        Update: {
          cached_at?: string | null
          explorer_data?: Json
          position_key?: string
        }
        Relationships: []
      }
      position_evals: {
        Row: {
          best_move_uci: string
          computed_at: string
          depth: number
          eval_cp: number | null
          mate_in: number | null
          position_key: string
          pv_uci: string[]
        }
        Insert: {
          best_move_uci: string
          computed_at?: string
          depth: number
          eval_cp?: number | null
          mate_in?: number | null
          position_key: string
          pv_uci?: string[]
        }
        Update: {
          best_move_uci?: string
          computed_at?: string
          depth?: number
          eval_cp?: number | null
          mate_in?: number | null
          position_key?: string
          pv_uci?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          id: string
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id: string
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      puzzle_history: {
        Row: {
          attempted_at: string | null
          id: string
          puzzle_id: string
          solved: boolean
          time_seconds: number | null
          user_id: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          puzzle_id: string
          solved: boolean
          time_seconds?: number | null
          user_id: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          puzzle_id?: string
          solved?: boolean
          time_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzle_history_puzzle_id_fkey"
            columns: ["puzzle_id"]
            isOneToOne: false
            referencedRelation: "puzzles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puzzle_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      puzzles: {
        Row: {
          fen: string
          id: string
          moves: string[]
          popularity: number | null
          rating: number
          themes: string[]
        }
        Insert: {
          fen: string
          id: string
          moves: string[]
          popularity?: number | null
          rating: number
          themes?: string[]
        }
        Update: {
          fen?: string
          id?: string
          moves?: string[]
          popularity?: number | null
          rating?: number
          themes?: string[]
        }
        Relationships: []
      }
      store_books: {
        Row: {
          book_id: string
          coverage: number | null
          published_at: string
          rating_count: number
          rating_sum: number
          save_count: number
        }
        Insert: {
          book_id: string
          coverage?: number | null
          published_at?: string
          rating_count?: number
          rating_sum?: number
          save_count?: number
        }
        Update: {
          book_id?: string
          coverage?: number | null
          published_at?: string
          rating_count?: number
          rating_sum?: number
          save_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "opening_books"
            referencedColumns: ["id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          book_id: string | null
          correct_moves: number | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          moves_played: Json
          result: string
          total_moves: number | null
          user_id: string
        }
        Insert: {
          book_id?: string | null
          correct_moves?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          moves_played?: Json
          result: string
          total_moves?: number | null
          user_id: string
        }
        Update: {
          book_id?: string | null
          correct_moves?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          moves_played?: Json
          result?: string
          total_moves?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "opening_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          calls: number
          day: string
          kind: string
          user_id: string | null
        }
        Insert: {
          calls?: number
          day?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          calls?: number
          day?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_position_stats: {
        Row: {
          book_id: string
          failure_count: number
          last_visited_at: string | null
          position_key: string
          success_count: number
          times_visited: number
          user_id: string
        }
        Insert: {
          book_id: string
          failure_count?: number
          last_visited_at?: string | null
          position_key: string
          success_count?: number
          times_visited?: number
          user_id: string
        }
        Update: {
          book_id?: string
          failure_count?: number
          last_visited_at?: string | null
          position_key?: string
          success_count?: number
          times_visited?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_position_stats_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "opening_books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_position_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      verified_publishers: {
        Row: {
          user_id: string
          verified_at: string
        }
        Insert: {
          user_id: string
          verified_at?: string
        }
        Update: {
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "verified_publishers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_game_history: { Args: { p_user_id: string }; Returns: number }
      commit_game_history: {
        Args: {
          p_cap: number
          p_chunks: Json
          p_deleted: number[]
          p_expected_version: number
          p_games: number
          p_imports: Json
          p_last_import_at: string
          p_limit: number
          p_user_id: string
          p_username: string
          p_written: number[]
        }
        Returns: number
      }
      count_book_save: {
        Args: { p_book_id: string; p_user_id: string }
        Returns: boolean
      }
      delete_review: {
        Args: { p_book_id: string; p_user_id: string }
        Returns: boolean
      }
      increment_usage: {
        Args: { p_kind: string; p_user_id?: string }
        Returns: number
      }
      review_book: {
        Args: {
          p_body: string
          p_book_id: string
          p_stars: number
          p_user_id: string
        }
        Returns: string
      }
      stage_game_history_chunk: {
        Args: {
          p_base_version: number
          p_cap: number
          p_clocks: Json
          p_game_count: number
          p_games: Json
          p_import_ids: number[]
          p_n: number
          p_user_id: string
        }
        Returns: string
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
