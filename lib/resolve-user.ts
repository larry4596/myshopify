import "server-only";

import { getToken } from "next-auth/jwt";

import { userIdFromGoogleSub } from "@/lib/users";

/**
 * THE one session resolver for every API route the web and the app share
 * (PRD-LESSON3 §4.2, A4): it accepts either credential, with one code path —
 *
 *   • the Auth.js session cookie (web requests — behaviour identical to
 *     `auth()` for the browser, since the cookie IS an Auth.js JWT), or
 *   • `Authorization: Bearer <token>` (the app — a token minted by
 *     POST /api/mobile/auth/exchange through Auth.js's own `encode`, so it
 *     is the same JWE, same AUTH_SECRET, same claims).
 *
 * Auth.js's `getToken` already implements "cookie, else Bearer" per cookie
 * name — we simply try both cookie-name salts (secure and non-secure hosts),
 * which is why a token minted on localhost and one minted on Vercel both
 * resolve. Nothing here does its own crypto.
 */

/** Cookie name Auth.js uses on https hosts (Vercel). */
export const SESSION_COOKIE_SECURE = "__Secure-next-auth.session-token";
/** Cookie name Auth.js uses on http hosts (localhost dev). */
export const SESSION_COOKIE_PLAIN = "next-auth.session-token";

export interface ResolvedUser {
  /** `public.users.id` — the deterministic UUIDv5, same as `session.user.id`. */
  id: string;
  /** Google account id (`sub`) — what `users.id` is derived from. */
  sub: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

/**
 * Resolve the caller of `request` to a user, or null when no valid
 * credential is present. Never throws: callers turn null into 401.
 */
export async function resolveUser(request: Request): Promise<ResolvedUser | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  for (const cookieName of [SESSION_COOKIE_SECURE, SESSION_COOKIE_PLAIN]) {
    try {
      const payload = await getToken({
        req: { headers: request.headers },
        secret,
        cookieName,
      });
      if (payload?.sub) {
        return {
          // Same derivation the session callback uses (auth.ts) — one
          // function, so web and app can never disagree about who this is.
          id: userIdFromGoogleSub(payload.sub),
          sub: payload.sub,
          name: payload.name ?? null,
          email: payload.email ?? null,
          image: payload.picture ?? null,
        };
      }
    } catch {
      // Wrong salt / malformed / expired — try the next cookie name.
    }
  }
  return null;
}