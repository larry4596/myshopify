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

  if (!error) return { ok: true };

  // 23505 = unique_violation. The usual cause here is an `email` already
  // belonging to a DIFFERENT row — a stale row from Phase 3 testing or a
  // manual Table-Editor edit. The upsert above cannot fix that, but if the
  // row for THIS account's id already exists we can still refresh it without
  // touching the contested email (FR2.4: sync must never break sign-in).
  if (error.code === "23505") {
    const { data: existing, error: lookupError } = await db
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (lookupError) {
      console.error("[users] sync failed:", lookupError.message);
      return { ok: false, message: lookupError.message };
    }

    if (existing) {
      const { error: updateError } = await db
        .from("users")
        .update({ name: user.name ?? null, image: user.image ?? null })
        .eq("id", user.id);

      if (updateError) {
        console.error("[users] sync failed:", updateError.message);
        return { ok: false, message: updateError.message };
      }
      return { ok: true };
    }

    // No row for this id and the email is owned by another id — nothing this
    // layer can safely reconcile. Say exactly what to fix instead of a bare
    // error, so the next failure isn't a mystery (see README).
    console.error(
      `[users] sync failed: email "${user.email}" is already used by a different ` +
        `user id and no row exists for this account's id (${user.id}). ` +
        `Reconcile the duplicate in the Supabase SQL Editor.`,
    );
    return { ok: false, message: `email already in use: ${error.message}` };
  }

  console.error("[users] sync failed:", error.message);
  return { ok: false, message: error.message };
}
