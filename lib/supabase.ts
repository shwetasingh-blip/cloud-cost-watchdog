import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Supabase errors are plain objects ({ message, details, hint, code }),
// not Error instances, so a bare `instanceof Error` check misses them.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

// Server-only. The service role / secret key must never reach the
// browser — every page that needs this data goes through our own API
// routes, which are the only thing that imports this file.
let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  cached = createClient(url, key, {
    auth: { persistSession: false },
  });
  return cached;
}
