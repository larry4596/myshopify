import "server-only";

/**
 * Minimal Mailgun client (PRD FR5) — plain `fetch` against Mailgun's HTTP API,
 * no SDK, which matches how the project talks to Paystack (lib/paystack.ts)
 * and keeps the dependency list light (PRD §5).
 *
 * `MAILGUN_API_KEY` is server-only and must never be exposed with a
 * NEXT_PUBLIC_ prefix (PRD §9, G7). `server-only` above makes any accidental
 * client import fail the build rather than leak the key.
 */

const MAILGUN_API = "https://api.mailgun.net/v3";

/** True once all three Mailgun variables hold real values (not placeholders). */
export function isMailgunConfigured(): boolean {
  const key = process.env.MAILGUN_API_KEY?.trim();
  const domain = process.env.MAILGUN_DOMAIN?.trim();
  const from = process.env.MAILGUN_FROM?.trim();
  if (!key || !domain || !from) return false;
  if (key.includes("your-") || domain.includes("your-") || from.includes("your-")) {
    return false;
  }
  return true;
}

export type ConfirmationEmailInput = {
  /** Recipient — the buyer's Google account email (FR5.2). */
  to: string;
  subject: string;
  /** Branded responsive HTML body (FR5.3). */
  html: string;
  /** Plain-text twin for clients that don't render HTML. */
  text: string;
};

export type MailgunSendResult =
  | { ok: true; messageId: string }
  | { ok: false; message: string };

/**
 * Send the order confirmation email (FR5.1 — server-side, immediately after
 * the payment is verified and the order saved).
 *
 * Never throws: a Mailgun outage must not break checkout (FR5.4), so every
 * failure path resolves to `{ ok: false, message }` for the caller to log.
 */
export async function sendOrderConfirmation(
  input: ConfirmationEmailInput,
): Promise<MailgunSendResult> {
  if (!isMailgunConfigured()) {
    return { ok: false, message: "Mailgun is not configured." };
  }

  const apiKey = process.env.MAILGUN_API_KEY!.trim();
  const domain = process.env.MAILGUN_DOMAIN!.trim();
  const from = process.env.MAILGUN_FROM!.trim();

  try {
    const body = new URLSearchParams({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    const response = await fetch(
      `${MAILGUN_API}/${encodeURIComponent(domain)}/messages`,
      {
        method: "POST",
        headers: {
          // Mailgun HTTP Basic auth: username "api", password the private key.
          Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        // Never cache an outgoing email.
        cache: "no-store",
      },
    );

    const payload = (await response
      .json()
      .catch(() => null)) as { id?: string; message?: string } | null;

    if (!response.ok || !payload?.id) {
      console.error(
        "[mailgun] send failed:",
        payload?.message ?? `HTTP ${response.status}`,
      );
      return {
        ok: false,
        message: payload?.message ?? `Mailgun responded with HTTP ${response.status}.`,
      };
    }

    return { ok: true, messageId: payload.id };
  } catch (error) {
    console.error("[mailgun] send error:", error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach Mailgun.",
    };
  }
}
