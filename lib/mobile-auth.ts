import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * P1 mobile sign-in plumbing (PRD-LESSON3 §7.1) — the parts shared by the
 * three /api/mobile/auth/* routes:
 *
 *  - the REDIRECT ALLOW-LIST: `finish` may only ever bounce the browser to a
 *    target the app itself owns (its own deep-link scheme), never anywhere
 *    else. Two targets exist, because Expo Go and a real build register
 *    different schemes (expo-linking resolveScheme):
 *      · `naijabites://`       — development build / release APK
 *      · `exp://<host>[:port]` — Expo Go running this project from Metro
 *  - a SIGNED transaction blob (`txn`) carrying the redirect target from
 *    `start` to `finish` unmodified, so hitting `finish` directly cannot
 *    choose an arbitrary target. HMAC-SHA256 over AUTH_SECRET — the same
 *    secret Auth.js already rotates.
 *  - the ONE-TIME CODE table: 60-second TTL, consumed with a single atomic
 *    DELETE ... RETURNING, so a replayed exchange can never mint a second
 *    token (see consumeAuthCode).
 *
 * No new environment variables: AUTH_SECRET only.
 */

/** How long /api/mobile/auth/finish's code stays redeemable (PRD §7.1). */
export const AUTH_CODE_TTL_MS = 60_000;

/** How long a signed txn stays valid between start and finish (generous). */
const TXN_TTL_MS = 10 * 60_000;

/**
 * The ONLY URLs /api/mobile/auth/finish may redirect the browser to.
 * Deliberately strict — the app's own scheme verbatim, and Expo Go's `exp://`
 * scheme (host of a Metro dev server, optionally followed by a path — LAN mode
 * has none, tunnel mode does). Scheme-level acceptance for `exp://` is a
 * conscious trade: only the app can start the flow, and the code in the URL is
 * 60-second, single-use and useless without the exchange.
 */
const ALLOWED_REDIRECT_PATTERNS: readonly RegExp[] = [
  // App scheme: bare `naijabites://` (+ optional query), nothing else.
  /^naijabites:\/\/(?:\?.*)?$/,
  // Expo Go: `exp://` + host[:port] (+ optional path/query/fragment).
  /^exp:\/\/[^/?#]+(?::\d{1,5})?(?:[/?#].*)?$/,
];

/** True when the app's requested deep-link target is one we own. */
export function isAllowedRedirect(uri: unknown): uri is string {
  if (typeof uri !== "string" || uri.length === 0 || uri.length > 300) {
    return false;
  }
  return ALLOWED_REDIRECT_PATTERNS.some((pattern) => pattern.test(uri));
}

function hmac(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set — cannot sign mobile auth transactions.");
  }
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/**
 * Bind the allow-listed redirect target to a tamper-evident blob that travels
 * through the browser (a query param on the callbackUrl) and returns at finish.
 */
export function signRedirectTxn(redirectUri: string): string {
  const payload = Buffer.from(
    JSON.stringify({ r: redirectUri, e: Date.now() + TXN_TTL_MS }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

/** Returns the redirect target, or null when the txn is forged/expired. */
export function verifyRedirectTxn(txn: unknown): string | null {
  if (typeof txn !== "string" || txn.length > 600) return null;
  const separator = txn.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = txn.slice(0, separator);
  const signature = txn.slice(separator + 1);

  const expected = hmac(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      r?: unknown;
      e?: unknown;
    };
    if (typeof parsed.e !== "number" || parsed.e < Date.now()) return null;
    // Defence in depth: even a valid txn must point at an allow-listed target.
    if (!isAllowedRedirect(parsed.r)) return null;
    return parsed.r;
  } catch {
    return null;
  }
}

/** The claims an exchange needs to mint a 30-day session token. */
export interface AuthCodeRecord {
  userId: string;
  sub: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Insert a single-use code and return it (hex, 256 bits of randomness), or
 * null when Supabase is unavailable / the insert failed.
 *
 * A best-effort purge of expired rows rides along on every issue — codes live
 * a minute, so the table stays near-empty without a scheduled job.
 */
export async function issueAuthCode(record: AuthCodeRecord): Promise<string | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const code = randomBytes(32).toString("hex");
  const { error } = await db.from("mobile_auth_codes").insert({
    code,
    user_id: record.userId,
    sub: record.sub,
    name: record.name,
    email: record.email,
    image: record.image,
    expires_at: new Date(Date.now() + AUTH_CODE_TTL_MS).toISOString(),
  });

  if (error) {
    console.error("[mobile-auth] could not issue code:", error.message);
    return null;
  }

  // Fire-and-forget: at this point the only rows it can delete are garbage.
  void db
    .from("mobile_auth_codes")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return code;
}

/**
 * Atomically consume a code: DELETE … WHERE code = ? AND not expired
 * RETURNING the row. The delete IS the single-use check — two parallel
 * exchanges race on the same row and exactly one gets it back.
 * Returns null for unknown, expired or already-used codes.
 */
export async function consumeAuthCode(code: string): Promise<AuthCodeRecord | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data, error } = await db
    .from("mobile_auth_codes")
    .delete()
    .eq("code", code)
    .gte("expires_at", new Date().toISOString())
    .select("user_id, sub, name, email, image")
    .maybeSingle();

  if (error) {
    console.error("[mobile-auth] could not consume code:", error.message);
    return null;
  }
  if (!data) return null;

  return {
    userId: data.user_id,
    sub: data.sub,
    name: data.name,
    email: data.email,
    image: data.image,
  };
}