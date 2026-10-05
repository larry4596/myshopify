/**
 * Public runtime configuration.
 *
 * EXPO_PUBLIC_* variables are inlined into the JS bundle at build time, so
 * anything here is readable by anyone who has the app — which is exactly why
 * only public values live here. No Supabase key, no Paystack secret: the app
 * talks to the Next.js BFF, which owns every secret (PRD-LESSON3 §3).
 */

const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '');

/** Origin of the deployed store, e.g. https://myshopify-seven.vercel.app */
export const API_BASE_URL = withoutTrailingSlash(
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim(),
);

/**
 * The deep-link scheme the app registers (app.json → `scheme`). Sign-in uses
 * it as the allow-listed redirect target the server bounces back to after
 * issuing a code (PRD-LESSON3 §7.1). No OAuth client id lives in this app —
 * the browser flow owns Google entirely (PRD-LESSON3 §4).
 */
export const APP_SCHEME = 'naijabites';

export const isApiConfigured = API_BASE_URL.length > 0;
