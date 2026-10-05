import { isAllowedRedirect, signRedirectTxn } from "@/lib/mobile-auth";
import { getSiteUrl } from "@/lib/site-url";

/**
 * GET /api/mobile/auth/start?redirect_uri=<app deep-link>
 *
 * Step 1 of the mobile browser sign-in (PRD-LESSON3 §7.1). The app opens this
 * URL with `WebBrowser.openAuthSessionAsync`, so what follows happens entirely
 * inside a real Chrome Custom Tab, on the web app's OWN Auth.js flow:
 *
 *   start → (auto-POST below) → /api/auth/signin/google → Google consent
 *        → /api/auth/callback/google  (session cookie set — the usual web flow)
 *        → /api/mobile/auth/finish    (same-origin callbackUrl, signed txn)
 *        → 302 naijabites://?code=…   (allow-listed target) → back in the app
 *
 * Why a tiny auto-submitting form and not a plain redirect: Auth.js v5 only
 * mints the Google authorization URL on POST (CSRF-protected — GET renders
 * pages), and CSRF tokens must be fetched by the browser itself. So the
 * browser posts the exact same form the website's "Continue with Google"
 * button posts. Nothing about the Google client changes: Google still
 * redirects only to this site's registered https callback.
 *
 * The redirect target is validated against the allow-list HERE (fast feedback
 * for the app) and again inside `finish` (the only place it is ever used).
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const redirectUri = searchParams.get("redirect_uri");

  if (!isAllowedRedirect(redirectUri)) {
    return Response.json(
      {
        message:
          "redirect_uri must be one of: naijabites:// (app build) or exp://<host> (Expo Go).",
      },
      { status: 400 },
    );
  }

  const origin = getSiteUrl(request);
  const finishUrl = `${origin}/api/mobile/auth/finish?txn=${encodeURIComponent(
    signRedirectTxn(redirectUri),
  )}`;

  // Escape for an HTML attribute; the txn itself is base64url (no quotes),
  // but escaping keeps this correct even if that ever changes.
  const safeFinishUrl = finishUrl
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Signing in to NaijaBites…</title></head>
<body style="font-family: system-ui, sans-serif; color: #1A1A1A; background: #F9F5EB; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <p style="font-weight: 700;">Signing in to NaijaBites…</p>
    <p style="color: #555;">You can close this tab if nothing happens.</p>
    <form id="nb-auth" method="post" action="/api/auth/signin/google">
      <input type="hidden" name="csrfToken" id="nb-csrf">
      <input type="hidden" name="callbackUrl" value="${safeFinishUrl}">
    </form>
  </div>
  <script>
    // Fetch a CSRF token the way Auth.js expects it (same-origin cookie +
    // body pair), then submit the canonical provider-signin form.
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then(function (response) { return response.json(); })
      .then(function (data) {
        document.getElementById("nb-csrf").value = data.csrfToken;
        document.getElementById("nb-auth").submit();
      });
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}