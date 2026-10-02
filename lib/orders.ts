import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";
import { upsertUser } from "@/lib/users";

/**
 * Order history data access (PRD FR3.3 — orders live strictly server-side;
 * nothing about them ever touches localStorage).
 *
 * All queries run through the service-role key in server components only.
 * The service-role key never reaches the browser (PRD G7).
 */

export type OrderListItem = {
  id: string;
  orderNumber: string;
  status: "pending" | "paid" | "failed";
  totalKobo: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  items: OrderItemView[];
};

export type OrderItemView = {
  productName: string;
  unitPriceKobo: number;
  quantity: number;
};

export type OrdersPageResult =
  /** Supabase env vars missing/placeholders — show setup instructions. */
  | { status: "unconfigured" }
  /** Query failed — show a retryable error state; details logged server-side. */
  | { status: "error" }
  /** Success — `orders` may be empty (first-time customer). */
  | { status: "ok"; orders: OrderListItem[] };

/**
 * Fetch every order for one user, newest first, with its items (FR3.4:
 * order number, date, status, items, total).
 *
 * Two flat queries + grouping in TS instead of a nested select — simpler to
 * type-check and more than fast enough for a personal order history.
 */
export async function getOrdersForUser(
  userId: string,
): Promise<OrdersPageResult> {
  const db = getSupabaseAdmin();
  if (!db) return { status: "unconfigured" };

  const { data: orderRows, error: ordersError } = await db
    .from("orders")
    .select(
      "id, order_number, status, total_kobo, currency, customer_name, customer_phone, address, notes, paid_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("[orders] fetch failed:", ordersError.message);
    return { status: "error" };
  }
  if (!orderRows || orderRows.length === 0) {
    return { status: "ok", orders: [] };
  }

  const orderIds = orderRows.map((order) => order.id);
  const { data: itemRows, error: itemsError } = await db
    .from("order_items")
    .select("order_id, product_name, unit_price_kobo, quantity")
    .in("order_id", orderIds);

  if (itemsError) {
    console.error("[orders] items fetch failed:", itemsError.message);
    return { status: "error" };
  }

  const itemsByOrder = new Map<string, OrderItemView[]>();
  for (const item of itemRows ?? []) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      productName: item.product_name,
      unitPriceKobo: item.unit_price_kobo,
      quantity: item.quantity,
    });
    itemsByOrder.set(item.order_id, list);
  }

  return {
    status: "ok",
    orders: orderRows.map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      totalKobo: order.total_kobo,
      currency: order.currency,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      address: order.address,
      notes: order.notes,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      items: itemsByOrder.get(order.id) ?? [],
    })),
  };
}

export type CreateOrderInput = {
  /** The signed-in user — ensured in `users` first (self-healing FR2.4 sync). */
  user: { id: string; email: string; name?: string | null; image?: string | null };
  /** Cart lines keyed by catalog slug; quantities 1..20. */
  items: { slug: string; quantity: number }[];
  customerName: string;
  customerPhone: string;
  address: string;
  notes?: string | null;
};

export type CreateOrderResult =
  | { status: "ok"; orderId: string }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/**
 * Atomically create an order + items via the `create_order` Postgres
 * function (FR3.5). Prices are re-derived from `products` inside the
 * function — this wrapper's `items` carry slugs and quantities ONLY.
 *
 * Wires up Phase 4 checkout: call only after Paystack payment is verified
 * server-side (FR4.5/FR4.7).
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const db = getSupabaseAdmin();
  if (!db) return { status: "unconfigured" };

  // The orders FK requires the user row; upsert again in case the sign-in
  // sync was skipped (e.g. Supabase was configured after they signed in).
  const sync = await upsertUser(input.user);
  if (!sync.ok) {
    return { status: "error", message: "Could not sync user before ordering" };
  }

  const { data, error } = await db.rpc("create_order", {
    p_user_id: input.user.id,
    p_items: input.items,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_address: input.address,
    p_notes: input.notes ?? null,
    p_status: "paid",
  });

  if (error) {
    console.error("[orders] create_order failed:", error.message);
    return { status: "error", message: error.message };
  }

  return { status: "ok", orderId: data };
}
