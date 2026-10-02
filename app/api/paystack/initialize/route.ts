import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { priceCart, isRawCartItem, type RawCartItem } from "@/lib/pricing";
import { initializeTransaction, isPaystackConfigured } from "@/lib/paystack";
import { getSiteUrl } from "@/lib/site-url";

/**
 * POST /api/paystack/initialize (PRD FR4.4)
 *
 * Creates the Paystack transaction for the signed-in customer's cart.
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

  const initialized = await initializeTransaction({
    email: session.user.email,
    amountKobo: cart.totalKobo,
    reference,
    callbackUrl: `${getSiteUrl()}/api/paystack/verify`,
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

  return NextResponse.json({
    authorizationUrl: initialized.authorizationUrl,
    reference: initialized.reference,
  });
}