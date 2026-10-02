import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
 * Reached only by /api/paystack/verify, and only after Paystack confirmed the
 * payment and the order row exists — so this page simply reads the order back
 * (also proving the order really is in the database).
 */

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

async function loadOrder(orderId: string, userId: string): Promise<OrderReceipt | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: order, error } = await db
    .from("orders")
    .select(
      "id, order_number, total_kobo, created_at, customer_name, customer_phone, address, notes",
    )
    .eq("id", orderId)
    // Scoped to the signed-in customer, exactly like /orders: an order id
    // alone is never enough to read someone else's receipt.
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !order) return null;

  const { data: items } = await db
    .from("order_items")
    .select("product_name, unit_price_kobo, quantity")
    .eq("order_id", orderId);

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
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/orders")}`);
  }

  const { orderId, ref } = await searchParams;
  if (!orderId) notFound();

  const order = await loadOrder(orderId, session.user.id);
  if (!order) notFound();

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

        {/* Phase 5 will replace this line with a real Mailgun send. */}
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