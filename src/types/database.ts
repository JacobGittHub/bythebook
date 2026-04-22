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
      opening_books: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_public: boolean | null
          move_node: Json
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          move_node?: Json
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_public?: boolean | null
          move_node?: Json
          name?: string
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
          fen: string
        }
        Insert: {
          cached_at?: string | null
          explorer_data: Json
          fen: string
        }
        Update: {
          cached_at?: string | null
          explorer_data?: Json
          fen?: string
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
