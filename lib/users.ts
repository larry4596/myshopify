import "server-only";

import { createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * User identity + sync (PRD FR2.4, §8).
 *
 * The PRD pins `users.id` to `uuid` with `orders.user_id` FK'ing to it, but
 * Google's stable account id (`sub`) is an opaque string — not a UUID.
 * Rather than adding an off-spec column or doing a lookup on every request,
 * we derive a DETERMINISTIC UUIDv5 from the sub:
 *
 *   same Google account  ->  same UUID, on every device, forever (PRD G4)
 *   no extra table, no query to resolve "who am I"
 *
 * The fixed namespace below is a one-time random UUID generated for this
 * project — it must never change (changing it would re-key every user).
 */
const USER_ID_NAMESPACE = "11398d0f-9b90-4320-9c2b-c830f19fe94c";

/**
 * Deterministic UUID (RFC 4122 version 5, SHA-1) for a Google account id.
 * Server-side only — uses Node's crypto.
 */
export function userIdFromGoogleSub(sub: string): string {
  const namespaceBytes = Buffer.from(USER_ID_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1")
    .update(Buffer.concat([namespaceBytes, Buffer.from(`google:${sub}`, "utf8")]))
    .digest();

  const uuid = Array.from(hash.subarray(0, 16));
  uuid[6] = (uuid[6] & 0x0f) | 0x50; // version 5
  uuid[8] = (uuid[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = uuid.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type SyncableUser = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

export type SyncResult =
  | { ok: true }
  | { ok: false; skipped: true }
  | { ok: false; message: string };

/**
 * Upsert the signed-in user into `public.users` (FR2.4: happens on sign-in,
 * idempotent — returning users just refresh name/image/email).
 *
 * NEVER throws: a database problem must not be able to break Google sign-in.
 * Returns why it didn't run so callers that need durability (order creation)
 * can react.
 */
export async function upsertUser(user: SyncableUser): Promise<SyncResult> {
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, skipped: true };

  const { error } = await db.from("users").upsert(
    {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[users] sync failed:", error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true };
}
