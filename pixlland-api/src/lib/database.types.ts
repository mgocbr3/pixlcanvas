export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      assets: {
        Row: {
          id: number;
          project_id: number;
          branch_id: string | null;
          name: string;
          type: string;
          tags: string[] | null;
          meta: Json | null;
          data: Json | null;
          file: Json | null;
          path: Json | null;
          preload: boolean | null;
          source: boolean | null;
          source_asset_id: number | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          project_id: number;
          branch_id?: string | null;
          name: string;
          type: string;
          tags?: string[] | null;
          meta?: Json | null;
          data?: Json | null;
          file?: Json | null;
          path?: Json | null;
          preload?: boolean | null;
          source?: boolean | null;
          source_asset_id?: number | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          project_id?: number;
          branch_id?: string | null;
          name?: string;
          type?: string;
          tags?: string[] | null;
          meta?: Json | null;
          data?: Json | null;
          file?: Json | null;
          path?: Json | null;
          preload?: boolean | null;
          source?: boolean | null;
          source_asset_id?: number | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: number;
          project_id: number;
          name: string;
          is_master: boolean;
          created_by: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          project_id: number;
          name: string;
          is_master?: boolean;
          created_by?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          project_id?: number;
          name?: string;
          is_master?: boolean;
          created_by?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          private: boolean;
          owner_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          private?: boolean;
          owner_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          name?: string;
          description?: string | null;
          private?: boolean;
          owner_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      scenes: {
        Row: {
          id: number;
          unique_id: string | null;
          name: string;
          project_id: number;
          branch_id: string | null;
          owner_id: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: number;
          unique_id?: string | null;
          name: string;
          project_id: number;
          branch_id?: string | null;
          owner_id?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: number;
          unique_id?: string | null;
          name?: string;
          project_id?: number;
          branch_id?: string | null;
          owner_id?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
