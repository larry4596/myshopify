import { getToken } from "next-auth/jwt";

import { userIdFromGoogleSub } from "@/lib/users";
import { issueAuthCode, verifyRedirectTxn } from "@/lib/mobile-auth";

/**
 * GET /api/mobile/auth/finish?txn=<signed redirect>
 *
 * Step 3 of the mobile browser sign-in (PRD-LESSON3 §7.1). Auth.js redirects
 * here (same-origin, validated by Auth.js's own callbackUrl rules) after the
 * Google consent — still inside the Custom Tab, still carrying the session
 * cookie that /api/auth/callback/google just set.
 *
 * What `finish` does, in order:
 *   1. verify the signed txn → recover the allow-listed redirect target;
 *   2. read the Auth.js session claims straight from the request cookie
 *      (sub = the Google account id — the ONLY input users.id needs);
 *   3. issue a 60-second, single-use code bound to those claims; and
 *   4. 302 to `naijabites://?code=…` / `exp://…?code=…`, which the OS hands
 *      back to the app, closing the Custom Tab.
 *
 * Unauthenticated (user closed the tab / cookie missing) or a bad txn renders
 * a small human-readable page instead of a redirect — there is nothing to
 * bounce back to when the flow never completed.
 */

/** The two cookie-name salts Auth.js uses (secure vs. plain hosts). */
const COOKIE_NAMES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

interface SessionClaims {
  sub?: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
}

async function readSessionClaims(
  request: Request,
  secret: string,
): Promise<SessionClaims | null> {
  for (const cookieName of COOKIE_NAMES) {
    try {
      const claims = await getToken({
        req: { headers: request.headers },
        secret,
        cookieName,
      });
      if (claims?.sub) return claims as SessionClaims;
    } catch {
      // Wrong salt for this host — try the other one.
    }
  }
  return null;
}

function errorPage(message: string): Response {
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return new Response(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>NaijaBites sign-in</title></head>` +
      `<body style="font-family: system-ui, sans-serif; background:#F9F5EB; color:#1A1A1A; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0;">` +
      `<div style="text-align:center; max-width:28rem; padding:1.5rem;">` +
      `<p style="font-weight:700;">Sign-in could not be completed</p>` +
      `<p style="color:#555;">${safe}</p>` +
      `<p style="color:#555;">Return to the app and try again.</p>` +
      `</div></body></html>`,
    { status: 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const redirectUri = verifyRedirectTxn(searchParams.get("txn"));
  if (!redirectUri) {
    return errorPage("This sign-in link is invalid or has expired.");
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return errorPage("The server is missing AUTH_SECRET — contact the operator.");
  }

  const claims = await readSessionClaims(request, secret);
  if (!claims?.sub) {
    return errorPage("No Google session was established in this browser.");
  }

  const code = await issueAuthCode({
    // Exactly what auth.ts's session callback would derive — the same human,
    // the same public.users.id, on every device (PRD-LESSON3 §4).
    userId: userIdFromGoogleSub(claims.sub),
    sub: claims.sub,
    name: claims.name ?? null,
    email: claims.email ?? null,
    image: claims.picture ?? null,
  });
  if (!code) {
    return errorPage(
      "The server could not create a sign-in session (Supabase unavailable or not configured).",
    );
  }

  const separator = redirectUri.includes("?") ? "&" : "?";
  return new Response(null, {
    status: 302,
    headers: {
      location: `${redirectUri}${separator}code=${encodeURIComponent(code)}`,
      "cache-control": "no-store",
    },
  });
}