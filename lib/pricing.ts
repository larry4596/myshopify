import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Server-authoritative cart pricing (PRD FR4.7).
 *
 * The browser cart deliberately carries NO prices — only slugs + quantities.
 * Every price used for a payment is read from `public.products` here, so a
 * tampered request can't buy a ₦7,500 box for ₦1. `create_order` re-prices
 * again on insert (FR3.5), so this is the second of three independent checks.
 */

export type RawCartItem = { slug: string; quantity: number };

export type PricedLine = {
  slug: string;
  name: string;
  unitPriceKobo: number;
  quantity: number;
  lineTotalKobo: number;
};

export type PricedCart = {
  lines: PricedLine[];
  totalKobo: number;
  itemCount: number;
};

/** `{slug, quantity}` pairs only — anything else is rejected by the caller. */
export function isRawCartItem(value: unknown): value is RawCartItem {
  if (typeof value !== "object" || value === null) return false;
  const { slug, quantity } = value as { slug?: unknown; quantity?: unknown };
  return typeof slug === "string" && typeof quantity === "number";
}

/**
 * Validate the request body and derive the amount to charge.
 *
 * Rejects: empty carts, duplicate slugs, non-integer quantities and quantities
 * outside 1..20 (the same window `create_order` enforces), plus inactive or
 * unknown products. Duplicates are rejected on purpose — the cart is keyed by
 * slug, so a repeated slug means the request wasn't built by our own UI.
 */
export async function priceCart(
  items: RawCartItem[],
): Promise<
  | { status: "ok"; cart: PricedCart }
  | { status: "invalid"; message: string }
  | { status: "unconfigured" }
> {
  if (!Array.isArray(items) || items.length === 0) {
    return { status: "invalid", message: "Your cart is empty." };
  }

  const quantities = new Map<string, number>();
  for (const item of items) {
    if (typeof item.slug !== "string" || item.slug.trim() === "") {
      return { status: "invalid", message: "Unknown item in cart." };
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return {
        status: "invalid",
        message: "Item quantities must be whole numbers between 1 and 20.",
      };
    }
    if (quantities.has(item.slug)) {
      return { status: "invalid", message: "Duplicate item in cart." };
    }
    quantities.set(item.slug, item.quantity);
  }

  const db = getSupabaseAdmin();
  if (!db) return { status: "unconfigured" };

  const { data, error } = await db
    .from("products")
    .select("slug, name, price_kobo, is_active")
    .in("slug", [...quantities.keys()]);

  if (error) {
    console.error("[pricing] product lookup failed:", error.message);
    return { status: "invalid", message: "We couldn't price your cart." };
  }

  const bySlug = new Map((data ?? []).map((row) => [row.slug, row]));

  const lines: PricedLine[] = [];
  let totalKobo = 0;
  let itemCount = 0;

  // Walk the REQUEST order so the summary matches what the customer saw.
  for (const [slug, quantity] of quantities) {
    const product = bySlug.get(slug);
    if (!product) {
      return {
        status: "invalid",
        message: "One of the items in your cart is no longer available.",
      };
    }
    if (!product.is_active) {
      return { status: "invalid", message: `${product.name} is sold out.` };
    }

    const lineTotalKobo = product.price_kobo * quantity;
    totalKobo += lineTotalKobo;
    itemCount += quantity;
    lines.push({
      slug: product.slug,
      name: product.name,
      unitPriceKobo: product.price_kobo,
      quantity,
      lineTotalKobo,
    });
  }

  return { status: "ok", cart: { lines, totalKobo, itemCount } };
}