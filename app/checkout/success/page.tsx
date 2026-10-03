import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatNaira } from "@/lib/products";
import ClearCartOnSuccess from "@/components/ClearCartOnSuccess";

export const metadata: Metadata = {
  title: "Order confirmed",
};

/**
 * Post-payment success page (PRD FR4.5 / FR4.6).
 *
 * Reached only from /api/paystack/verify, and only after Paystack confirmed the
 * payment — so this page simply reads the order back (also proving the order
 * really is in the database).
 *
 * It is the ORDER CONFIRMATION, so it must not be able to 404 on a paid order:
 *   • the receipt is resolved by `orderId` when the callback passed one, and by
 *     the Paystack `ref` when it didn't (replayed callback, hand-opened verify
 *     link, stripped query string) — both lookups scoped to the signed-in user;
 *   • a signed-out visitor keeps the full receipt URL through /signin;
 *   • if the order still can't be read, a self-healing card is rendered instead
 *     of `notFound()` — its "check again" button re-runs /api/paystack/verify,
 *     which creates the order when the payment is confirmed and lands back here
 *     with the order id.
 */

/** Where this page lives — must match the verify route's redirect. */
const SUCCESS_PATH = "/checkout/success";

const dateFormatter = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

type OrderReceipt = {
  orderNumber: string;
  totalKobo: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string | null;
  items: { productName: string; unitPriceKobo: number; quantity: number }[];
};

async function loadOrder(
  selector: { orderId: string } | { reference: string },
  userId: string,
): Promise<OrderReceipt | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  // Scoped to the signed-in customer, exactly like /orders: an order id (or a
  // Paystack reference) alone is never enough to read someone else's receipt.
  const byIdOrReference = "orderId" in selector
    ? { column: "id" as const, value: selector.orderId }
    : { column: "paystack_reference" as const, value: selector.reference };

  const { data: order, error } = await db
    .from("orders")
    .select(
      "id, order_number, total_kobo, created_at, customer_name, customer_phone, address, notes",
    )
    .eq("user_id", userId)
    .eq(byIdOrReference.column, byIdOrReference.value)
    .maybeSingle();

  if (error || !order) {
    if (error) console.error("[checkout/success] receipt lookup failed:", error.message);
    return null;
  }

  const { data: items } = await db
    .from("order_items")
    .select("product_name, unit_price_kobo, quantity")
    .eq("order_id", order.id);

  return {
    orderNumber: order.order_number,
    totalKobo: order.total_kobo,
    createdAt: order.created_at,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    address: order.address,
    notes: order.notes,
    items: (items ?? []).map((item) => ({
      productName: item.product_name,
      unitPriceKobo: item.unit_price_kobo,
      quantity: item.quantity,
    })),
  };
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; ref?: string }>;
}) {
  const { orderId, ref } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) {
    // Keep the RECEIPT URL intact across sign-in instead of dropping the
    // customer on /orders — this page IS the order confirmation (FR4.6), and a
    // callback that lands without a session must not lose it.
    const back = new URLSearchParams();
    if (orderId) back.set("orderId", orderId);
    if (ref) back.set("ref", ref);
    const target = back.toString() ? `${SUCCESS_PATH}?${back.toString()}` : "/orders";
    redirect(`/signin?callbackUrl=${encodeURIComponent(target)}`);
  }

  // Resolve the receipt: by order id when the callback passed one, otherwise by
  // the Paystack reference (a replayed callback, a hand-opened verify link or a
  // stripped query string must not turn a paid order into a 404).
  let order: OrderReceipt | null = null;
  if (orderId) order = await loadOrder({ orderId }, session.user.id);
  if (!order && ref) order = await loadOrder({ reference: ref }, session.user.id);

  if (!order) {
    return <ConfirmationPending reference={ref ?? null} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      {/* The payment is verified — empty the localStorage cart. */}
      <ClearCartOnSuccess />

      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-black/5 sm:p-10">
        <p className="text-5xl" aria-hidden>
          🎉
        </p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
          Payment confirmed — thank you!
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          Your snacks are being prepared fresh. We&apos;ve saved this order to
          your account, so it stays here even after you close the browser.
        </p>

        <p className="mt-6 rounded-xl bg-brand-light px-4 py-3 font-mono text-sm font-bold tracking-tight text-brand">
          {order.orderNumber}
        </p>
        <p className="mt-2 text-xs text-ink/50">
          Placed {dateFormatter.format(new Date(order.createdAt))}
        </p>

        <ul className="mt-6 space-y-2 border-t border-black/5 pt-4 text-left text-sm">
          {order.items.map((item) => (
            <li
              key={item.productName}
              className="flex items-baseline justify-between gap-4"
            >
              <span className="text-ink/70">
                {item.productName}{" "}
                <span className="text-ink/40">× {item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium">
                {formatNaira(item.unitPriceKobo * item.quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between border-t border-black/5 pt-4">
          <span className="text-sm font-semibold text-ink/70">Total paid</span>
          <span className="text-xl font-extrabold text-brand">
            {formatNaira(order.totalKobo)}
          </span>
        </div>

        <p className="mt-4 text-left text-xs leading-relaxed text-ink/50">
          Delivering to {order.customerName} · {order.customerPhone} —{" "}
          {order.address}
          {order.notes ? ` (${order.notes})` : ""}
        </p>

        {/* The Mailgun confirmation email is sent server-side by
            /api/paystack/verify (FR5.1) BEFORE the redirect lands here — this
            copy tells the customer where it went; the server log reports any
            send failure ([mailgun] ...), never the receipt (FR5.4). */}
        <p className="mt-6 rounded-xl bg-cream px-4 py-3 text-xs leading-relaxed text-ink/60">
          A confirmation email is on its way to{" "}
          <span className="font-semibold text-ink/70">{session.user.email}</span>
          .
        </p>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/orders"
            className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            View my orders
          </Link>
          <Link
            href="/#menu"
            className="rounded-full border border-brand/30 px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand-light"
          >
            Continue shopping
          </Link>
          {ref && (
            <a
              href={`https://dashboard.paystack.com/#/transactions/${encodeURIComponent(ref)}`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-ink/60 transition-colors hover:bg-cream"
            >
              View receipt
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shown when the payment is back but the receipt can't be read yet — a paid
 * order must never present a bare 404. The primary action re-runs the verify
 * route with the customer's reference: if Paystack confirms the payment it
 * creates the order and redirects straight back here with the order id; if it
 * doesn't, the customer lands on /checkout with the readable error (FR4.6).
 */
function ConfirmationPending({ reference }: { reference: string | null }) {
  const reverifyHref = reference
    ? `/api/paystack/verify?reference=${encodeURIComponent(reference)}`
    : null;
  const databaseConnected = Boolean(getSupabaseAdmin());

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-black/5 sm:p-10">
        <p className="text-5xl" aria-hidden>
          ⏳
        </p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
          We&apos;re confirming your payment
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          {databaseConnected
            ? "Your payment is with Paystack and we're finishing saving your order. It's safe to check again — you will never be charged twice."
            : "We couldn't reach the store's database just now. If you were charged, your order is safe — give it a moment, then check your orders."}
        </p>

        {reference && (
          <p className="mt-6 rounded-xl bg-cream px-4 py-3 text-sm text-ink/60">
            Paystack reference{" "}
            <span className="font-mono font-semibold text-ink/70">{reference}</span>
          </p>
        )}

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {reverifyHref && (
            <Link
              href={reverifyHref}
              className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Check my payment again
            </Link>
          )}
          <Link
            href="/orders"
            className="rounded-full border border-brand/30 px-6 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand-light"
          >
            View my orders
          </Link>
          <Link
            href="/checkout"
            className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-ink/60 transition-colors hover:bg-cream"
          >
            Back to checkout
          </Link>
        </div>

        {!databaseConnected && (
          <p className="mt-6 rounded-xl bg-cream px-4 py-3 text-left text-xs leading-relaxed text-ink/50">
            The Supabase environment variables don&apos;t look set on this
            deployment — see README → Supabase setup.
          </p>
        )}
      </div>
    </div>
  );
}