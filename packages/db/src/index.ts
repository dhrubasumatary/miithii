import { createClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string | null;
          display_name?: string | null;
        };
      };
      subtitle_jobs: {
        Row: {
          id: string;
          user_id: string;
          source_file_url: string | null;
          source_language: string;
          target_language: string | null;
          status: "queued" | "processing" | "complete" | "failed";
          result: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source_file_url?: string | null;
          source_language: string;
          target_language?: string | null;
          status?: "queued" | "processing" | "complete" | "failed";
          result?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          source_file_url?: string | null;
          source_language?: string;
          target_language?: string | null;
          status?: "queued" | "processing" | "complete" | "failed";
          result?: Json | null;
          updated_at?: string;
        };
      };
    };
  };
};

export function createSupabaseDbClient(url: string, key: string) {
  return createClient<Database>(url, key);
}

