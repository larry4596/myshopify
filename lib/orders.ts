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
  /**
   * The verified Paystack reference (FR4.5). Stored on the order and unique in
   * the database, so a refreshed/replayed callback can only ever produce ONE
   * order (no double-charging, no duplicate rows).
   */
  paystackReference: string;
};

export type CreateOrderResult =
  | { status: "ok"; orderId: string }
  | { status: "already_created"; orderId: string }
  | { status: "unconfigured" }
  | { status: "error"; message: string };

/**
 * Has this Paystack reference already produced an order? (FR4.5 idempotency.)
 *
 * The verify route runs on every return from Paystack — including a manual
 * refresh of the callback URL — so this lookup is what stops a second order
 * from being created for the same payment.
 */
export async function findOrderIdByReference(
  paystackReference: string,
): Promise<{ status: "found"; orderId: string } | { status: "missing" } | { status: "unconfigured" } | { status: "error" }> {
  const db = getSupabaseAdmin();
  if (!db) return { status: "unconfigured" };

  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("paystack_reference", paystackReference)
    .maybeSingle();

  if (error) {
    console.error("[orders] reference lookup failed:", error.message);
    return { status: "error" };
  }
  return data ? { status: "found", orderId: data.id } : { status: "missing" };
}

/**
 * Atomically create an order + items via the `create_order` Postgres
 * function (FR3.5). Prices are re-derived from `products` inside the
 * function — this wrapper's `items` carry slugs and quantities ONLY.
 *
 * Called from /api/paystack/verify once a payment is CONFIRMED (FR4.5/FR4.7):
 * an order can never be created without a verified Paystack payment.
 */
export async function createOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  const db = getSupabaseAdmin();
  if (!db) return { status: "unconfigured" };

  // A retry after a partial failure must not create a second order.
  const existing = await findOrderIdByReference(input.paystackReference);
  if (existing.status === "found") {
    return { status: "already_created", orderId: existing.orderId };
  }
  if (existing.status === "error" || existing.status === "unconfigured") {
    return { status: "error", message: "Could not check for an existing order" };
  }

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
    p_paystack_reference: input.paystackReference,
  });

  if (error) {
    // 23505 = unique_violation: a concurrent callback won the race and created
    // the order first. That's success for the customer, so return that order.
    if (error.code === "23505") {
      const again = await findOrderIdByReference(input.paystackReference);
      if (again.status === "found") {
        return { status: "already_created", orderId: again.orderId };
      }
    }
    console.error("[orders] create_order failed:", error.message);

    // Schema drift is the most likely cause of ANY failure in here: the function
    // deployed in Supabase is an older copy of supabase/schema.sql. Two
    // signatures are worth naming, because Postgres does not:
    //   - "function ... create_order(...) does not exist"  → predates the Phase 4
    //     p_paystack_reference argument and paystack_reference column
    //   - "operator does not exist: record ->> unknown"    → predates the jsonb
    //     fix for the pricing loop (v_item must be jsonb, never record, or the
    //     loop variable holds a ROW and ->> is undefined for it)
    // Neither message contains "create_order", so match on the shape too.
    if (/record\s*->>|p_paystack_reference|create_order/i.test(error.message)) {
      console.error(
        "[orders] create_order in the database looks out of date — re-run " +
          "supabase/schema.sql in the Supabase SQL Editor. It is idempotent: it " +
          "drops and replaces the function and adds the paystack_reference " +
          "column and its unique index.",
      );
    }
    return { status: "error", message: error.message };
  }

  return { status: "ok", orderId: data };
}

export type OrderEmailRow = {
  orderNumber: string;
  totalKobo: number;
  createdAt: string;
  customerName: string;
  customerPhone: string;
  address: string;
  notes: string | null;
  items: { productName: string; unitPriceKobo: number; quantity: number }[];
};

/**
 * Read a freshly-created order back for its confirmation email (FR5.3).
 *
 * Returns the SAVED receipt — order number and the price snapshots written by
 * `create_order` — so the email always matches what the database (and the
 * success page) shows, never what the request happened to carry.
 */
export async function getOrderForEmail(
  orderId: string,
): Promise<OrderEmailRow | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: order, error } = await db
    .from("orders")
    .select(
      "id, order_number, total_kobo, created_at, customer_name, customer_phone, address, notes",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    if (error) console.error("[orders] email receipt lookup failed:", error.message);
    return null;
  }

  const { data: items, error: itemsError } = await db
    .from("order_items")
    .select("product_name, unit_price_kobo, quantity")
    .eq("order_id", order.id);

  if (itemsError) {
    console.error("[orders] email items lookup failed:", itemsError.message);
    return null;
  }

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

