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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          auto_sync_enabled: boolean
          enabled_municipios: string[]
          id: string
          sync_interval_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_sync_enabled?: boolean
          enabled_municipios?: string[]
          id?: string
          sync_interval_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_sync_enabled?: boolean
          enabled_municipios?: string[]
          id?: string
          sync_interval_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      municipios: {
        Row: {
          created_at: string
          estado: string
          geom_geojson: string | null
          id: string
          last_sync_at: string | null
          nome: string
          populacao: number | null
          regiao: string | null
          uf: string | null
        }
        Insert: {
          created_at?: string
          estado: string
          geom_geojson?: string | null
          id?: string
          last_sync_at?: string | null
          nome: string
          populacao?: number | null
          regiao?: string | null
          uf?: string | null
        }
        Update: {
          created_at?: string
          estado?: string
          geom_geojson?: string | null
          id?: string
          last_sync_at?: string | null
          nome?: string
          populacao?: number | null
          regiao?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      ranking: {
        Row: {
          created_at: string
          id: string
          km_paved_added: number
          km_unpaved: number
          municipio_id: string
          periodo: string
          score: number
        }
        Insert: {
          created_at?: string
          id?: string
          km_paved_added?: number
          km_unpaved?: number
          municipio_id: string
          periodo: string
          score?: number
        }
        Update: {
          created_at?: string
          id?: string
          km_paved_added?: number
          km_unpaved?: number
          municipio_id?: string
          periodo?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vias: {
        Row: {
          created_at: string
          geom_geojson: string | null
          id: string
          length_m: number
          municipio_id: string
          nome: string | null
          osm_id: number
          snapshot_date: string
          surface: string
        }
        Insert: {
          created_at?: string
          geom_geojson?: string | null
          id?: string
          length_m?: number
          municipio_id: string
          nome?: string | null
          osm_id: number
          snapshot_date?: string
          surface: string
        }
        Update: {
          created_at?: string
          geom_geojson?: string | null
          id?: string
          length_m?: number
          municipio_id?: string
          nome?: string | null
          osm_id?: number
          snapshot_date?: string
          surface?: string
        }
        Relationships: [
          {
            foreignKeyName: "vias_municipio_id_fkey"
            columns: ["municipio_id"]
            isOneToOne: false
            referencedRelation: "municipios"
            referencedColumns: ["id"]
          },
        ]
      }
      vias_snapshots: {
        Row: {
          created_at: string
          data_jsonb: Json | null
          id: string
          municipio_id: string
          snapshot_at: string
          total_km_unpaved: number
          total_vias: number
        }
        Insert: {
          created_at?: string
          data_jsonb?: Json | null
          id?: string
          municipio_id: string
          snapshot_at?: string
          total_km_unpaved?: number
          total_vias?: number
        }
        Update: {
          created_at?: string
          data_jsonb?: Json | null
          id?: string
          municipio_id?: string
          snapshot_at?: string
          total_km_unpaved?: number
          total_vias?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
