import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { priceCart, isRawCartItem, type RawCartItem } from "@/lib/pricing";
import { initializeTransaction, isPaystackConfigured } from "@/lib/paystack";
import { getPaystackCallbackUrl, isPaystackRedirectable, resolveSiteUrl, buildManualVerifyUrl } from "@/lib/site-url";

/**
 * POST /api/paystack/initialize (PRD FR4.4)
 *
 * Creates the Paystack transaction for the signed-in customer's cart.
 *
 * `callback_url` is sent here (see lib/site-url.ts): Paystack's docs state it
 * "overrides the callback url provided on the dashboard for this transaction",
 * so the dashboard's Callback URL field can stay blank.
 *
 * SECURITY — nothing about money is trusted from the browser:
 *   • the cart arrives as `{slug, quantity}` only; `priceCart` re-reads every
 *     price from `products` and computes the total server-side (FR4.7)
 *   • the customer's email comes from the session, not the request body
 *   • the delivery details are stashed in Paystack `metadata`, which is only
 *     read back from Paystack's own verify response (never from the client)
 *   • `PAYSTACK_SECRET_KEY` stays on the server (PRD G7)
 *
 * Answers `{ authorizationUrl }` for the form to redirect to, or
 * `{ message }` with a 4xx/5xx on failure.
 */

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8_000;

type InitializeBody = {
  items?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  address?: unknown;
  notes?: unknown;
};

/** Same-shot validation of the delivery details the customer typed. */
function readDelivery(body: InitializeBody) {
  const read = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

  const customerName = read(body.customerName, 80);
  const customerPhone = read(body.customerPhone, 20);
  const address = read(body.address, 300);
  const notes = read(body.notes, 500);

  if (customerName.length < 2) {
    return { ok: false as const, message: "Please enter your full name." };
  }
  if (!/^[0-9+\-\s()]{7,20}$/.test(customerPhone)) {
    return { ok: false as const, message: "Please enter a valid phone number." };
  }
  if (address.length < 10) {
    return {
      ok: false as const,
      message: "Please enter a delivery address (at least 10 characters).",
    };
  }

  return { ok: true as const, customerName, customerPhone, address, notes };
}

export async function POST(request: Request) {
  // Sign-in required (PRD FR2.5) — enforced again, server-side, even though
  // /checkout already redirects.
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json(
      { message: "Please sign in again before paying." },
      { status: 401 },
    );
  }

  if (!isPaystackConfigured()) {
    return NextResponse.json(
      {
        message:
          "Payments aren't set up yet — add the Paystack test keys to .env.local and restart the dev server.",
      },
      { status: 503 },
    );
  }

  // Cheap guard before parsing anything.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ message: "Cart payload too large." }, { status: 413 });
  }

  const body = (await request.json().catch(() => null)) as InitializeBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request." }, { status: 400 });
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > 20) {
    return NextResponse.json(
      { message: "Your cart is empty." },
      { status: 400 },
    );
  }
  if (!rawItems.every(isRawCartItem)) {
    return NextResponse.json(
      { message: "Invalid cart contents." },
      { status: 400 },
    );
  }

  const delivery = readDelivery(body);
  if (!delivery.ok) {
    return NextResponse.json({ message: delivery.message }, { status: 400 });
  }

  // Authoritative pricing (FR4.7).
  const priced = await priceCart(rawItems as RawCartItem[]);
  if (priced.status === "unconfigured") {
    return NextResponse.json(
      {
        message:
          "The product database isn't connected yet, so we can't take payments. (See README → Supabase setup.)",
      },
      { status: 503 },
    );
  }
  if (priced.status === "invalid") {
    return NextResponse.json({ message: priced.message }, { status: 400 });
  }

  const { cart } = priced;
  const reference = `NB-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

  // ---------------------------------------------------------------------------
  // The URL Paystack sends the customer's browser back to after paying (FR4.5).
  // Built in one place, always absolute, never with a double slash.
  // ---------------------------------------------------------------------------
  const { source } = resolveSiteUrl(request);
  const callbackUrl = getPaystackCallbackUrl(request);

  // Paystack only returns a customer to a public HTTPS URL; its docs say
  // "Ensure that it only redirects to an HTTPS site" and "Ensure you don't use
  // localhost as your callback URL". What we do about that depends on where we
  // are running:
  //
  //   production  → refuse the payment (503). Charging someone we cannot return
  //                 to the store is worse than not charging them at all.
  //   development → warn and carry on. Forcing an HTTPS tunnel for every local
  //                 test is unreasonable, so the payment proceeds and the
  //                 customer finishes it by opening the verify URL BY HAND —
  //                 the checkout UI shows them that link (see `manualCallback`).
  const isProduction = process.env.NODE_ENV === "production";

  if (!isPaystackRedirectable(callbackUrl) && isProduction) {
    console.error(
      `[paystack] refusing to initialize: callback_url "${callbackUrl}" ` +
        `(source: ${source}) is not a public HTTPS URL. Paystack will not ` +
        `redirect a customer there, so the payment would succeed with no order. ` +
        `Set NEXT_PUBLIC_SITE_URL to an https:// URL a browser can load — e.g. ` +
        `a tunnel ("ngrok http 3000" -> https://<id>.ngrok.app) or the Vercel ` +
        `domain — then restart the dev server.`,
    );
    return NextResponse.json(
      {
        message:
          "Payments are paused: the store's public URL isn't set up for Paystack redirects yet.",
        detail:
          "Paystack only returns customers to an https:// URL (localhost is not supported). " +
          "Set NEXT_PUBLIC_SITE_URL to an https URL (tunnel or deployed domain) and restart the dev server.",
        callbackUrl,
      },
      { status: 503 },
    );
  }

  // Development with a localhost/http callback: Paystack will take the money and
  // then leave the browser on checkout.paystack.com. That is fine locally as
  // long as the customer is told how to finish — warn loudly and continue.
  if (!isPaystackRedirectable(callbackUrl)) {
    console.warn(
      `[paystack] development mode: callback_url "${callbackUrl}" (from ${source}) ` +
        `is not a public HTTPS URL, so Paystack will NOT redirect the browser back. ` +
        `The payment still works — after paying on Paystack, open this URL by hand ` +
        `to create the order: ${callbackUrl}?reference=<reference>. ` +
        `For real redirects locally, set NEXT_PUBLIC_SITE_URL to an https tunnel ` +
        `(e.g. "ngrok http 3000") and restart the dev server.`,
    );
  }

  // Proof in the server log of the exact URL Paystack is told to use.
  console.info(
    `[paystack] initialize ref=${reference} amount=${cart.totalKobo} kobo ` +
      `callback_url=${callbackUrl} (from ${source})`,
  );

  const initialized = await initializeTransaction({
    email: session.user.email,
    amountKobo: cart.totalKobo,
    reference,
    callbackUrl,
    metadata: {
      // Read back from Paystack's verify response — never from the client.
      user_id: session.user.id,
      customer_name: delivery.customerName,
      customer_phone: delivery.customerPhone,
      address: delivery.address,
      notes: delivery.notes || null,
      items: cart.lines.map((line) => ({
        slug: line.slug,
        quantity: line.quantity,
      })),
    },
  });

  if (!initialized.ok) {
    return NextResponse.json({ message: initialized.message }, { status: 502 });
  }

  // When Paystack can't redirect (localhost in development), give the UI the
  // link the customer must open by hand after paying. Built from the reference
  // Paystack confirmed, so the two can never drift apart.
  const manualVerifyUrl = isPaystackRedirectable(callbackUrl)
    ? null
    : buildManualVerifyUrl(callbackUrl, initialized.reference);

  return NextResponse.json({
    authorizationUrl: initialized.authorizationUrl,
    reference: initialized.reference,
    /** Echoed for debugging: the exact URL Paystack will return the browser to. */
    callbackUrl,
    /**
     * `null` in the normal (redirect) case. Otherwise the checkout UI shows
     * "pay in a new tab, then open this verify URL yourself".
     */
    manualCallback: manualVerifyUrl ? { verifyUrl: manualVerifyUrl } : null,
  });
}