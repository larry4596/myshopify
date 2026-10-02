/**
 * The store's own base URL.
 *
 * Used for anything that must be reachable FROM Paystack's servers (the
 * `callback_url`), so it can't be derived from a request that only exists on
 * our side. Order of precedence:
 *   1. NEXT_PUBLIC_SITE_URL   — localhost:3000 locally, the Vercel domain in
 *      production (PRD §9)
 *   2. VERCEL_URL             — automatic on Vercel deployments (previews)
 *   3. localhost:3000         — last-resort local default
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && /^https?:\/\//.test(configured)) {
    return configured.replace(/\/+$/, "");
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const withScheme = /^https?:\/\//.test(vercel) ? vercel : `https://${vercel}`;
    return withScheme.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}