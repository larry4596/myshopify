import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createOrder, findOrderIdByReference, getOrderForEmail } from "@/lib/orders";
import { priceCart, isRawCartItem, type RawCartItem } from "@/lib/pricing";
import { isPaystackConfigured, verifyTransaction } from "@/lib/paystack";
import { isMailgunConfigured, sendOrderConfirmation } from "@/lib/mailgun";
import {
  orderConfirmationSubject,
  renderOrderConfirmationHtml,
  renderOrderConfirmationText,
  type OrderEmailData,
} from "@/lib/order-email";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase";

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
 * confirm Paystack charged exactly that → confirm who the payment belongs to →
 * only then call `create_order`.
 *
 * WHO THE PAYMENT BELONGS TO — the Paystack fallback for a callback that lands
 * without a session: the signed-in session when there is one. When the cookie
 * didn't make it back (the customer was returned to a different host — Vercel
 * deployment URL vs. production alias vs. preview — opened the callback in
 * another tab, or re-opened the link by hand) we fall back to the payer
 * recorded in Paystack's `metadata`, which was bound server-side to the session
 * that STARTED the payment. Identity is never taken from the query string and
 * FR4.7 is unchanged: Paystack's own verify response still gates every order.
 *
 * Every failure redirects back to /checkout with a readable `?error=` code.
 */

export const runtime = "nodejs";

const SUCCESS_PATH = "/checkout/success";

function failureUrl(siteUrl: string, code: string): string {
  return `${siteUrl}/checkout?error=${code}`;
}

/**
 * FR4.6: the success page shows the order number — so the order id ALWAYS
 * travels with the redirect (the page reads the receipt back by it), and `ref`
 * lets it also offer the Paystack receipt link.
 */
function successUrl(siteUrl: string, orderId: string, reference: string): string {
  const params = new URLSearchParams({ orderId, ref: reference });
  return `${siteUrl}${SUCCESS_PATH}?${params.toString()}`;
}

export async function GET(request: Request) {
  // Prefer the browser-facing origin of this callback request, so the customer
  // is returned to the host they are actually signed in on (lib/site-url.ts).
  const siteUrl = getSiteUrl(request);
  const reference = new URL(request.url).searchParams.get("reference")
    ?? new URL(request.url).searchParams.get("trxref")
    ?? "";

  if (!reference) {
    return NextResponse.redirect(failureUrl(siteUrl, "missing_reference"));
  }

  const session = await auth();
  const sessionUserId = session?.user?.id ?? null;
  const sessionEmail = session?.user?.email ?? null;

  // 0 ── Already processed? Hand back the SAME order (refresh-safe) — always
  //      WITH its order id, so the success page renders the receipt instead of
  //      falling through to its not-found state. This runs before the session
  //      check on purpose: a replay that arrives without a cookie must still
  //      reach the receipt, and the success page re-checks ownership anyway.
  const existing = await findOrderIdByReference(reference);
  if (existing.status === "found") {
    return NextResponse.redirect(successUrl(siteUrl, existing.orderId, reference));
  }
  if (existing.status === "unconfigured") {
    return NextResponse.redirect(failureUrl(siteUrl, "not_configured"));
  }
  if (existing.status === "error") {
    return NextResponse.redirect(failureUrl(siteUrl, "order_failed"));
  }

  if (!isPaystackConfigured()) {
    return NextResponse.redirect(failureUrl(siteUrl, "not_configured"));
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
  const metadataUserId = typeof metadata.user_id === "string" ? metadata.user_id : "";

  // 2 ── Whose payment is this?
  let userId: string;
  let email: string;
  let name: string | null = null;
  let image: string | null = null;

  if (sessionUserId && sessionEmail) {
    // Normal case: the customer came back signed in on the same host.
    if (metadataUserId !== sessionUserId) {
      console.error(
        "[paystack] verify: metadata user_id does not match the session for",
        reference,
      );
      return NextResponse.redirect(failureUrl(siteUrl, "session_mismatch"));
    }
    userId = sessionUserId;
    email = sessionEmail;
    name = session?.user?.name ?? null;
    image = session?.user?.image ?? null;
  } else if (metadataUserId) {
    // FALLBACK: the callback arrived without a session. The payment was bound
    // to a signed-in customer when it was initialized (server-side, never from
    // the client), so Paystack's metadata — not the query string — says who to
    // attribute it to. Prefer the stored account row so name/image/email are
    // never clobbered by an empty session.
    const db = getSupabaseAdmin();
    let stored: { email: string; name: string | null; image: string | null } | null = null;
    if (db) {
      const { data, error } = await db
        .from("users")
        .select("email, name, image")
        .eq("id", metadataUserId)
        .maybeSingle();
      if (error) {
        console.error("[paystack] verify: payer lookup failed:", error.message);
      } else {
        stored = data;
      }
    }

    const fallbackEmail = stored?.email ?? transaction.customerEmail ?? "";
    if (!fallbackEmail) {
      // Nowhere to attribute the payment — refuse rather than guess.
      console.error(
        "[paystack] verify: callback without a session and no usable payer email for",
        reference,
      );
      return NextResponse.redirect(failureUrl(siteUrl, "session_mismatch"));
    }

    console.warn(
      `[paystack] verify: callback for ${reference} arrived without a session — ` +
        `attributing it to the payer recorded at initialize (${metadataUserId}). ` +
        `If this repeats, the host Paystack returns to differs from the host the ` +
        `customer browses on — check NEXT_PUBLIC_SITE_URL / the Vercel domain.`,
    );

    userId = metadataUserId;
    email = fallbackEmail;
    name = stored?.name ?? null;
    image = stored?.image ?? null;
  } else {
    // No session and nothing in Paystack's metadata to attribute to — this
    // transaction was not started by this app's checkout.
    console.error("[paystack] verify: no session and no metadata user_id for", reference);
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
    user: { id: userId, email, name, image },
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

  // 5 ── Confirmation email (Phase 5, FR5.1–FR5.4) — BEST EFFORT. The order is
  //      already saved, so a Mailgun failure must never block the receipt:
  //      log it loudly and redirect to the success page either way. Only a
  //      freshly created order sends; a replayed/raced callback that finds the
  //      order already there (`already_created`) never resends a duplicate.
  if (order.status === "ok") {
    try {
      const receipt = await getOrderForEmail(order.orderId);
      if (!receipt) {
        console.error(
          `[mailgun] confirmation skipped for ${reference}: order ${order.orderId} could not be read back.`,
        );
      } else if (!isMailgunConfigured()) {
        console.warn(
          `[mailgun] confirmation skipped for ${reference}: MAILGUN_API_KEY / MAILGUN_DOMAIN / MAILGUN_FROM are not set.`,
        );
      } else {
        const emailData: OrderEmailData = {
          orderNumber: receipt.orderNumber,
          createdAt: receipt.createdAt,
          customerName: receipt.customerName,
          customerPhone: receipt.customerPhone,
          address: receipt.address,
          notes: receipt.notes,
          items: receipt.items,
          totalKobo: receipt.totalKobo,
          receiptUrl: successUrl(siteUrl, order.orderId, reference),
        };
        const sent = await sendOrderConfirmation({
          to: email,
          subject: orderConfirmationSubject(receipt.orderNumber),
          html: renderOrderConfirmationHtml(emailData),
          text: renderOrderConfirmationText(emailData),
        });
        if (sent.ok) {
          console.log(
            `[mailgun] confirmation ${receipt.orderNumber} sent to ${email} (${sent.messageId})`,
          );
        } else {
          console.error(
            `[mailgun] confirmation FAILED for ${reference}: ${sent.message}`,
          );
        }
      }
    } catch (error) {
      // FR5.4: the receipt must never depend on the email.
      console.error("[mailgun] confirmation email error:", error);
    }
  }

  return NextResponse.redirect(successUrl(siteUrl, order.orderId, reference));
}