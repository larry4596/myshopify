/**
 * The store's own public origin, and the Paystack callback URL built from it.
 *
 * PAYSTACK'S RULES (support.paystack.com → "Setting up a callback URL"):
 *   • the callback URL must be an HTTPS URL a browser can load
 *   • localhost is NOT supported — Paystack accepts the initialize request but
 *     never redirects the customer back, so the payment happens and no order
 *     is created
 *   • the `callback_url` sent at transaction/initialize OVERRIDES the
 *     dashboard's "Callback URL" field, so that field can be left blank for
 *     this integration (paystack.com/docs/api/transaction → Initialize)
 *
 * Because getting this wrong is silent and expensive, the callback URL is
 * built in exactly ONE place here, is always absolute, never contains a double
 * slash, and reports which source it came from so the server log can prove it.
 */

/** Last-resort base for local development. */
const LOCAL_DEFAULT = "http://localhost:3000";

/** Where Paystack sends the customer after payment (PRD FR4.5). */
export const PAYSTACK_CALLBACK_PATH = "/api/paystack/verify";

export type SiteUrlSource =
  | "NEXT_PUBLIC_SITE_URL"
  | "VERCEL_URL"
  | "request"
  | "default";

/**
 * Join a base URL and a path with EXACTLY one slash between them, so a
 * trailing slash on the base (`https://store.com/`) can never produce
 * `https://store.com//api/...`.
 */
export function joinUrl(base: string, path: string): string {
  const cleanBase = base.trim().replace(/\/+$/, "");
  const cleanPath = path.trim().replace(/^\/+/, "");
  return cleanPath ? `${cleanBase}/${cleanPath}` : cleanBase;
}

/** The origin the browser used for this request (proxy-aware). */
function originFromRequest(request: Request): string | null {
  // Proxy chains may list several values ("a.example, b.example") — the FIRST
  // is the one the client used, and the only one that keeps the URL valid.
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const isLocal =
      host.startsWith("localhost") || host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]");
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = forwardedProto || (isLocal ? "http" : "https");
    return `${proto}://${host}`;
  }
  try {
    const origin = new URL(request.url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/**
 * Resolve the public origin Paystack should send the customer back to.
 *
 * WHY THE REQUEST'S OWN ORIGIN WINS: Paystack returns the customer's browser
 * to the callback URL as a fresh, cross-site navigation — the session cookie
 * only travels with it if it was set for THAT exact host. On Vercel the
 * production alias, the deployment URL (`VERCEL_URL`), preview URLs and any
 * custom domain are all different hosts with different cookies, so an origin
 * taken from an env var can send a signed-in customer back to a host where
 * they are signed out (payment verified, but "session_mismatch" and no order).
 * The host the customer is actually browsing on can never have that problem.
 *
 * Order of precedence:
 *   1. the request's origin — what the customer's browser actually used
 *      (proxy-aware: x-forwarded-proto/host, so Vercel's https is kept).
 *      Skipped in production when it is not an https URL (a localhost origin
 *      can never be a Paystack callback), where we fall through to:
 *   2. NEXT_PUBLIC_SITE_URL — the documented switch (PRD §9); set it to
 *      `http://localhost:3000` locally or the deployment URL in production.
 *      Also the source used when a caller has no request at all.
 *   3. VERCEL_URL           — set automatically by Vercel (previews included)
 *   4. http://localhost:3000
 *
 * The chosen source is returned too, so callers can log WHY they built the URL
 * they did.
 */
export function resolveSiteUrl(request?: Request): {
  url: string;
  source: SiteUrlSource;
} {
  if (request) {
    const origin = originFromRequest(request);
    if (origin) {
      const isProduction = process.env.NODE_ENV === "production";
      if (!isProduction || origin.startsWith("https://")) {
        return { url: origin.replace(/\/+$/, ""), source: "request" };
      }
      // Production over plain http (misconfigured proxy): never hand that to
      // Paystack — it refuses to redirect there and the payment would complete
      // with no order. Fall back to the configured URL instead.
      console.warn(
        `[site-url] ignoring request origin "${origin}" in production (not https) — ` +
          `using NEXT_PUBLIC_SITE_URL / VERCEL_URL for the Paystack callback instead.`,
      );
    }
  }

  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) {
    return { url: configured.replace(/\/+$/, ""), source: "NEXT_PUBLIC_SITE_URL" };
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withScheme = /^https?:\/\//i.test(vercel) ? vercel : `https://${vercel}`;
    return { url: withScheme.replace(/\/+$/, ""), source: "VERCEL_URL" };
  }

  return { url: LOCAL_DEFAULT, source: "default" };
}

/** The public origin, e.g. "https://naijabites.vercel.app". */
export function getSiteUrl(request?: Request): string {
  return resolveSiteUrl(request).url;
}

/**
 * The absolute callback URL handed to Paystack at initialize (PRD FR4.4).
 * `https://store.com/` + `/api/paystack/verify` → `https://store.com/api/paystack/verify`
 */
export function getPaystackCallbackUrl(request?: Request): string {
  return joinUrl(getSiteUrl(request), PAYSTACK_CALLBACK_PATH);
}

/**
 * The manual verify link, shown in the checkout UI when Paystack cannot
 * redirect the browser back (development only — see the initialize route).
 *
 * `http://localhost:3000/api/paystack/verify` + ref `NB-x` →
 * `http://localhost:3000/api/paystack/verify?reference=NB-x`
 */
export function buildManualVerifyUrl(callbackUrl: string, reference: string): string {
  const separator = callbackUrl.includes("?") ? "&" : "?";
  return `${callbackUrl}${separator}reference=${encodeURIComponent(reference)}`;
}

/**
 * Can Paystack actually redirect a customer to this URL?
 *
 * Only a public HTTPS URL qualifies — Paystack documents that `http://` and
 * localhost callback URLs are not redirected to (they are silently ignored,
 * falling back to the dashboard's Callback URL, which is blank here).
 */
export function isPaystackRedirectable(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false; // relative or malformed
  }
  if (parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return false;

  return true;
}