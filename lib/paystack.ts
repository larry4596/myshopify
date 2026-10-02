import "server-only";

/**
 * Minimal Paystack client (PRD FR4.4 / FR4.5) — plain `fetch`, no SDK, which
 * matches how the project talks to Mailgun in Phase 5.
 *
 * `PAYSTACK_SECRET_KEY` is server-only and must never be exposed with a
 * NEXT_PUBLIC_ prefix (PRD §9, G7). `server-only` above makes any accidental
 * client import fail the build rather than leak the key.
 */

const PAYSTACK_API = "https://api.paystack.co";

/** True once a real-looking test/live secret key is present. */
export function isPaystackConfigured(): boolean {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!key) return false;
  if (key.includes("your-")) return false;
  return key.startsWith("sk_test_") || key.startsWith("sk_live_");
}

/**
 * The test-mode keys currently in use — surfaced in the server log so a
 * misconfigured deployment is obvious instead of silently failing.
 */
export function isPaystackTestMode(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim().startsWith("sk_test_"));
}

export type PaystackInitializeInput = {
  email: string;
  /** Amount in kobo (₦ × 100) — integer math only (PRD §8). */
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResult =
  | { ok: true; authorizationUrl: string; accessCode: string; reference: string }
  | { ok: false; message: string };

type PaystackEnvelope<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

/**
 * Create a Paystack transaction and get the hosted checkout URL to send the
 * customer to. Only ever called from a server route handler.
 */
export async function initializeTransaction(
  input: PaystackInitializeInput,
): Promise<PaystackInitializeResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) return { ok: false, message: "Paystack is not configured." };

  try {
    const response = await fetch(`${PAYSTACK_API}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      // Never cache a payment initialization.
      cache: "no-store",
      body: JSON.stringify({
        email: input.email,
        amount: String(input.amountKobo),
        reference: input.reference,
        callback_url: input.callbackUrl,
        currency: "NGN",
        metadata: input.metadata,
      }),
    });

    const payload = (await response
      .json()
      .catch(() => null)) as PaystackEnvelope<{
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    }> | null;

    if (!response.ok || !payload?.status || !payload.data?.authorization_url) {
      console.error(
        "[paystack] initialize failed:",
        payload?.message ?? `HTTP ${response.status}`,
      );
      return {
        ok: false,
        message: payload?.message ?? "Paystack rejected the payment request.",
      };
    }

    return {
      ok: true,
      authorizationUrl: payload.data.authorization_url,
      accessCode: payload.data.access_code ?? "",
      reference: payload.data.reference ?? input.reference,
    };
  } catch (error) {
    console.error("[paystack] initialize error:", error);
    return { ok: false, message: "Could not reach Paystack." };
  }
}

export type PaystackVerifiedTransaction = {
  reference: string;
  /** Paystack's status string: "success" | "failed" | "abandoned" | ... */
  status: string;
  /** Amount Paystack actually collected, in kobo. */
  amountKobo: number;
  currency: string;
  customerEmail: string | null;
  metadata: Record<string, unknown>;
};

export type PaystackVerifyResult =
  | { ok: true; transaction: PaystackVerifiedTransaction }
  | { ok: false; message: string; notFound?: boolean };

type PaystackTransactionData = {
  reference?: string;
  status?: string;
  amount?: number;
  currency?: string;
  customer?: { email?: string } | null;
  metadata?: unknown;
};

/**
 * Verify a transaction by reference (FR4.5). This is the AUTHORITATIVE source
 * for the amount, currency and metadata — everything the client sent is
 * ignored at this point, so a forged callback can't create an order.
 */
export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyResult> {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) return { ok: false, message: "Paystack is not configured." };

  try {
    const response = await fetch(
      `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: "no-store",
      },
    );

    const payload = (await response
      .json()
      .catch(() => null)) as PaystackEnvelope<PaystackTransactionData> | null;

    if (!response.ok || !payload?.status || !payload.data?.reference) {
      console.error(
        "[paystack] verify failed:",
        payload?.message ?? `HTTP ${response.status}`,
      );
      return {
        ok: false,
        message: payload?.message ?? "Paystack could not verify that payment.",
        notFound: response.status === 404,
      };
    }

    const metadata =
      typeof payload.data.metadata === "object" && payload.data.metadata !== null
        ? (payload.data.metadata as Record<string, unknown>)
        : {};

    return {
      ok: true,
      transaction: {
        reference: payload.data.reference,
        status: payload.data.status ?? "failed",
        amountKobo: Number(payload.data.amount ?? 0),
        currency: payload.data.currency ?? "NGN",
        customerEmail: payload.data.customer?.email ?? null,
        metadata,
      },
    };
  } catch (error) {
    console.error("[paystack] verify error:", error);
    return { ok: false, message: "Could not reach Paystack." };
  }
}