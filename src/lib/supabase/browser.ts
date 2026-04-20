import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl, type AppDatabase } from "./shared";

export function createBrowserSupabaseClient() {
  return createClient<AppDatabase>(getSupabaseUrl(), getSupabaseAnonKey());
}
