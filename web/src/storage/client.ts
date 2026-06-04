import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazily build one shared client (data + auth). Anon/publishable key only.
export async function getClient(): Promise<SupabaseClient> {
  if (!client) {
    const { createClient } = await import("@supabase/supabase-js");
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase env not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
    client = createClient(url, key);
  }
  return client;
}
