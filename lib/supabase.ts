import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Server-side Supabase access (Phase 3).
 *
 * PRD FR3.2: the database is ONLY touched from server components / route
 * handlers using the service-role (secret) key, which bypasses RLS. The
 * `server-only` import makes any accidental client-bundle import fail the
 * build, so the key can never reach the browser (PRD G7).
 *
 * Tables have RLS enabled with zero policies, so a publishable/anon key would
 * be denied everything — that's intentional: no client-side DB access at all.
 */

/**
 * True once both env vars are present and look real (the `.env.example`
 * placeholders start with "your-" and must not count as configured).
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  if (!url.startsWith("https://") || url.includes("your-")) return false;
  if (key.includes("your-")) return false;

  // The publishable key (`sb_publishable_…`) is the anon equivalent: RLS is
  // enabled with ZERO policies, so it is denied every table by design and can
  // never serve server-side reads/writes. Treat it as "not configured" so the
  // UI shows the setup steps instead of a raw database error, and say exactly
  // what to fix in the server log.
  if (key.startsWith("sb_publishable_")) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY contains a publishable (anon) key. " +
        "Replace it with the secret key (sb_secret_…) from " +
        "Supabase -> Settings -> API Keys, then restart the dev server.",
    );
    return false;
  }

  return true;
}

let cached: SupabaseClient<Database> | null = null;

/**
 * Lazily-created, module-level admin client (one HTTP pool per server
 * process). Returns `null` when Supabase isn't configured yet — callers
 * surface that as a friendly "setup pending" state instead of crashing.
 *
 * Accepts both the legacy `eyJ...` service_role JWT and the current
 * `sb_secret_...` key (see supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
 */
export function getSupabaseAdmin(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (cached) return cached;

  cached = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
  return cached;
}
