import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl, type AppDatabase } from "./shared";

export function createServerSupabaseClient() {
  return createClient<AppDatabase>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
