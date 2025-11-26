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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          success: boolean | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          success?: boolean | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cims: {
        Row: {
          content: Json
          created_at: string
          deal_id: string
          export_formats: string[] | null
          id: string
          title: string
          updated_at: string
          user_id: string
          version: number
          workflow_state: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          deal_id: string
          export_formats?: string[] | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
          version?: number
          workflow_state?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          deal_id?: string
          export_formats?: string[] | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
          version?: number
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cims_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          company_name: string | null
          created_at: string
          id: string
          industry: string | null
          irl_template: string | null
          name: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          irl_template?: string | null
          name: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string | null
          created_at?: string
          id?: string
          industry?: string | null
          irl_template?: string | null
          name?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string | null
          created_at: string
          deal_id: string
          file_path: string
          file_size: number | null
          folder_path: string | null
          gcs_bucket: string | null
          gcs_object_path: string | null
          id: string
          irl_item_id: string | null
          mime_type: string | null
          name: string
          processing_status: string | null
          updated_at: string
          upload_status: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          deal_id: string
          file_path: string
          file_size?: number | null
          folder_path?: string | null
          gcs_bucket?: string | null
          gcs_object_path?: string | null
          id?: string
          irl_item_id?: string | null
          mime_type?: string | null
          name: string
          processing_status?: string | null
          updated_at?: string
          upload_status?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          deal_id?: string
          file_path?: string
          file_size?: number | null
          folder_path?: string | null
          gcs_bucket?: string | null
          gcs_object_path?: string | null
          id?: string
          irl_item_id?: string | null
          mime_type?: string | null
          name?: string
          processing_status?: string | null
          updated_at?: string
          upload_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_irl_item_id_fkey"
            columns: ["irl_item_id"]
            isOneToOne: false
            referencedRelation: "irl_items"
            referencedColumns: ["id"]
          },
        ]
      }
      findings: {
        Row: {
          confidence: number | null
          created_at: string
          deal_id: string
          document_id: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          page_number: number | null
          source_document: string | null
          text: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          deal_id: string
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          source_document?: string | null
          text: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          deal_id?: string
          document_id?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          page_number?: number | null
          source_document?: string | null
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "findings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "findings_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          confidence: number | null
          created_at: string
          deal_id: string
          id: string
          insight_type: string
          metadata: Json | null
          source_finding_ids: string[] | null
          text: string
          title: string | null
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          deal_id: string
          id?: string
          insight_type: string
          metadata?: Json | null
          source_finding_ids?: string[] | null
          text: string
          title?: string | null
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          deal_id?: string
          id?: string
          insight_type?: string
          metadata?: Json | null
          source_finding_ids?: string[] | null
          text?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      irl_items: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          irl_id: string
          name: string
          required: boolean | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          irl_id: string
          name: string
          required?: boolean | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          irl_id?: string
          name?: string
          required?: boolean | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "irl_items_irl_id_fkey"
            columns: ["irl_id"]
            isOneToOne: false
            referencedRelation: "irls"
            referencedColumns: ["id"]
          },
        ]
      }
      irls: {
        Row: {
          created_at: string
          deal_id: string
          id: string
          name: string
          progress_percent: number | null
          sections: Json
          template_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deal_id: string
          id?: string
          name: string
          progress_percent?: number | null
          sections?: Json
          template_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deal_id?: string
          id?: string
          name?: string
          progress_percent?: number | null
          sections?: Json
          template_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "irls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      qa_lists: {
        Row: {
          answer: string | null
          category: string | null
          created_at: string
          deal_id: string
          id: string
          priority: string | null
          question: string
          sources: Json | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          category?: string | null
          created_at?: string
          deal_id: string
          id?: string
          priority?: string | null
          question: string
          sources?: Json | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          category?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          priority?: string | null
          question?: string
          sources?: Json | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "qa_lists_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
