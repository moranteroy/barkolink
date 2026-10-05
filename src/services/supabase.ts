import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";
export const supabaseConfigured = Boolean(url && key);
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export const database = supabase;
export const staffDatabase = supabase;
export const functions = supabase;

export function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key to .env.local.",
    );
  return supabase;
}
