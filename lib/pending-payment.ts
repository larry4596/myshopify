/**
 * A Paystack payment that is in flight but will NOT come back to us on its own.
 *
 * Development only: Paystack does not redirect a browser to `http://localhost`,
 * so a local customer finishes the payment on Paystack and then opens the
 * verify URL BY HAND. The checkout UI shows that link, and this module keeps it
 * in `localStorage` so it survives the trip to Paystack's tab and any refresh.
 *
 * Client-safe by design (no server-only import) — the browser owns this state.
 */

export type PendingPayment = {
  /** Paystack reference, shown so the customer can quote it on the dashboard. */
  reference: string;
  /** Paystack's hosted checkout page to pay on (opened in a new tab). */
  authorizationUrl: string;
  /** The `/api/paystack/verify?reference=...` link that creates the order. */
  verifyUrl: string;
  /** Epoch ms — stale links are useless, so old entries are ignored. */
  createdAt: number;
};

const STORAGE_KEY = "naijabites:pending-paystack:v1";

/** Ignore anything older than this: a stale link only confuses the customer. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/** Read the pending payment, dropping anything malformed or stale. */
export function readPendingPayment(): PendingPayment | null {
  if (typeof window === "undefined") return null;

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    parsed = JSON.parse(raw);
  } catch {
    return null; // corrupt JSON — nothing to show
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const { reference, authorizationUrl, verifyUrl, createdAt } = parsed as Record<
    string,
    unknown
  >;
  const safeReference = asString(reference);
  const safeAuthorizationUrl = asString(authorizationUrl);
  const safeVerifyUrl = asString(verifyUrl);
  const safeCreatedAt = typeof createdAt === "number" ? createdAt : 0;

  if (!safeReference || !safeAuthorizationUrl || !safeVerifyUrl) return null;
  if (Date.now() - safeCreatedAt > MAX_AGE_MS) {
    clearPendingPayment();
    return null;
  }

  return {
    reference: safeReference,
    authorizationUrl: safeAuthorizationUrl,
    verifyUrl: safeVerifyUrl,
    createdAt: safeCreatedAt,
  };
}

export function savePendingPayment(payment: PendingPayment): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payment));
  } catch {
    // Private mode / quota — the notice still shows for this page view.
  }
}

export function clearPendingPayment(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the entry just lingers until it ages out.
  }
}