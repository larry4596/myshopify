import { encode } from "next-auth/jwt";

import { consumeAuthCode } from "@/lib/mobile-auth";
import { SESSION_COOKIE_SECURE } from "@/lib/resolve-user";

/**
 * POST /api/mobile/auth/exchange { code }
 *
 * Step 4 of the mobile browser sign-in (PRD-LESSON3 §7.1). Redeems the
 * 60-second single-use code from `finish` for a 30-day session token and
 * returns the profile the account screen renders.
 *
 * The token is minted with Auth.js's OWN `encode` (JWE, A256CBC-HS512, key
 * derived from AUTH_SECRET), salted with the secure session-cookie name — so
 * it is byte-for-byte the same credential shape as the website's session
 * cookie. That is what makes lib/resolve-user.ts a single implementation:
 * one `getToken` call accepts the web's cookie and this Bearer token alike.
 *
 * Single-use is enforced by consumeAuthCode's atomic DELETE … RETURNING —
 * a code that was already redeemed (or has aged out) simply returns no row,
 * and no token is minted.
 */

/** 30 days — Auth.js's own session default. */
const TOKEN_MAX_AGE_S = 30 * 24 * 60 * 60;

/** Request body cap (8 KB) — this endpoint mints credentials. */
const MAX_BODY_BYTES = 8 * 1024;

/**
 * Best-effort per-IP throttle. In-memory, so it is per serverless instance —
 * honest about being a brake on accidental hammering, not a security border
 * (the codes themselves are the real limiter: 60 s, single-use, 256 bits).
 */
const RATE_LIMIT = { max: 15, windowMs: 10 * 60_000 };
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();

  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    if (hits.size > 1_000) {
      for (const [key, value] of hits) {
        if (value.resetAt <= now) hits.delete(key);
      }
    }
    hits.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT.max;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(request)) {
    return Response.json(
      { message: "Too many attempts — wait a minute and sign in again." },
      { status: 429, headers: { "cache-control": "no-store" } },
    );
  }

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) {
    return Response.json({ message: "Request too large." }, { status: 413 });
  }

  let code: unknown;
  try {
    ({ code } = JSON.parse(text || "{}") as { code?: unknown });
  } catch {
    return Response.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  // Codes are randomBytes(32).toString("hex") — reject anything else early.
  if (typeof code !== "string" || !/^[0-9a-f]{64}$/.test(code)) {
    return Response.json({ message: "Malformed sign-in code." }, { status: 400 });
  }

  const record = await consumeAuthCode(code);
  if (!record) {
    return Response.json(
      { message: "That sign-in code is invalid, expired or already used — try again." },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return Response.json(
      { message: "The server is missing AUTH_SECRET — contact the operator." },
      { status: 500 },
    );
  }

  const token = await encode({
    token: {
      sub: record.sub,
      name: record.name ?? undefined,
      email: record.email ?? undefined,
      picture: record.image ?? undefined,
    },
    secret,
    maxAge: TOKEN_MAX_AGE_S,
    salt: SESSION_COOKIE_SECURE,
  });

  return Response.json(
    {
      token,
      user: {
        id: record.userId,
        name: record.name,
        email: record.email,
        image: record.image,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}