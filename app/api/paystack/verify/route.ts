import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createOrder, findOrderIdByReference } from "@/lib/orders";
import { priceCart, isRawCartItem, type RawCartItem } from "@/lib/pricing";
import { isPaystackConfigured, verifyTransaction } from "@/lib/paystack";
import { getSiteUrl } from "@/lib/site-url";

/**
 * GET /api/paystack/verify — Paystack's `callback_url` (PRD FR4.5 / FR4.6).
 *
 * Paystack redirects the customer's browser here with `?reference=...` (or
 * `?trxref=...`). Because it's a GET, it can be refreshed or replayed, so the
 * route must be idempotent — it is, twice over:
 *   1. `findOrderIdByReference` returns the existing order instead of making a
 *      new one
 *   2. `orders.paystack_reference` is UNIQUE, so even a simultaneous double
 *      callback can't insert two orders
 *
 * ORDER OF OPERATIONS (FR4.7 — an order is never created without a verified
 * payment): ask Paystack → check status is `success` → re-price the cart and
 * confirm Paystack charged exactly that → confirm the payment belongs to the
 * signed-in user → only then call `create_order`.
 *
 * Every failure redirects back to /checkout with a readable `?error=` code.
 */

export const runtime = "nodejs";

const SUCCESS_URL = "/checkout/success";

function failureUrl(siteUrl: string, code: string): string {
  return `${siteUrl}/checkout?error=${code}`;
}

export async function GET(request: Request) {
  // Prefer the browser-facing origin of this callback request when the env var
  // is missing or stale, so the customer is returned to the right host.
  const siteUrl = getSiteUrl(request);
  const reference = new URL(request.url).searchParams.get("reference")
    ?? new URL(request.url).searchParams.get("trxref")
    ?? "";

  if (!reference) {
    return NextResponse.redirect(failureUrl(siteUrl, "missing_reference"));
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.redirect(failureUrl(siteUrl, "session_mismatch"));
  }

  if (!isPaystackConfigured()) {
    return NextResponse.redirect(failureUrl(siteUrl, "not_configured"));
  }

  // Already processed? Hand back the same order (refresh-safe).
  const existing = await findOrderIdByReference(reference);
  if (existing.status === "found") {
    return NextResponse.redirect(`${siteUrl}${SUCCESS_URL}?ref=${encodeURIComponent(reference)}`);
  }
  if (existing.status === "error") {
    return NextResponse.redirect(failureUrl(siteUrl, "order_failed"));
  }

  // 1 ── Ask Paystack. Its answer is the only source of truth from here on.
  const verified = await verifyTransaction(reference);
  if (!verified.ok) {
    return NextResponse.redirect(
      failureUrl(siteUrl, verified.notFound ? "missing_reference" : "verify_failed"),
    );
  }

  const transaction = verified.transaction;
  if (transaction.status !== "success") {
    return NextResponse.redirect(failureUrl(siteUrl, "payment_failed"));
  }

  const metadata = transaction.metadata;

  // 2 ── The payment must belong to THIS signed-in user.
  if (metadata.user_id !== session.user.id) {
    console.error(
      "[paystack] verify: metadata user_id does not match the session for",
      reference,
    );
    return NextResponse.redirect(failureUrl(siteUrl, "session_mismatch"));
  }

  // 3 ── Re-price the cart from the metadata slugs and require an exact match
  //      with what Paystack actually collected.
  const metadataItems = Array.isArray(metadata.items) ? metadata.items : [];
  if (!metadataItems.every(isRawCartItem)) {
    return NextResponse.redirect(failureUrl(siteUrl, "order_failed"));
  }

  const priced = await priceCart(metadataItems as RawCartItem[]);
  if (priced.status === "unconfigured") {
    return NextResponse.redirect(failureUrl(siteUrl, "not_configured"));
  }
  if (priced.status === "invalid") {
    console.error("[paystack] verify: cart could not be re-priced:", priced.message);
    return NextResponse.redirect(failureUrl(siteUrl, "order_failed"));
  }
  if (
    priced.cart.totalKobo !== transaction.amountKobo ||
    (transaction.currency && transaction.currency !== "NGN")
  ) {
    console.error(
      `[paystack] verify: amount mismatch for ${reference} — charged ${transaction.amountKobo}, cart is ${priced.cart.totalKobo}`,
    );
    return NextResponse.redirect(failureUrl(siteUrl, "amount_mismatch"));
  }

  // 4 ── Verified. Create the order (idempotent), which also snapshots the
  //      server-side prices inside the create_order transaction (FR3.5).
  const readMeta = (key: string) =>
    typeof metadata[key] === "string" ? (metadata[key] as string) : "";

  const order = await createOrder({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
    },
    items: priced.cart.lines.map((line) => ({
      slug: line.slug,
      quantity: line.quantity,
    })),
    customerName: readMeta("customer_name"),
    customerPhone: readMeta("customer_phone"),
    address: readMeta("address"),
    notes: readMeta("notes") || null,
    paystackReference: reference,
  });

  if (order.status === "error" || order.status === "unconfigured") {
    console.error("[paystack] verify: order creation failed for", reference);
    return NextResponse.redirect(failureUrl(siteUrl, "order_failed"));
  }

  // Phase 5 will send the Mailgun confirmation email from right here.

  // FR4.6: the success page shows the order number. `ref` lets it also offer
  // the Paystack receipt link.
  return NextResponse.redirect(
    `${siteUrl}${SUCCESS_URL}?orderId=${order.orderId}&ref=${encodeURIComponent(reference)}`,
  );
}