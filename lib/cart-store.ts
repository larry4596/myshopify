import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Server cart store — Lesson 3 P3 (PRD-LESSON3 §§6.2, 7.2, 7.3).
 *
 * The ONLY module that touches `public.cart_items`. Both platforms call it
 * through the shared routes (`GET /api/cart`, `PUT /api/cart/items`,
 * `DELETE /api/cart`); the API speaks slugs, this module maps them to
 * `product_id` internally (products.slug is UNIQUE, so the mapping is 1:1).
 */

export interface ServerCartLine {
  slug: string;
  quantity: number;
}

interface ProductRow {
  id: string;
  slug: string;
}

interface CartItemRow {
  product_id: string;
  quantity: number;
  updated_at: string;
}

/** Slug → product map for the given slugs (active products only). */
async function resolveProductIds(slugs: string[]): Promise<Map<string, ProductRow>> {
  const db = getSupabaseAdmin();
  const bySlug = new Map<string, ProductRow>();
  if (!db || slugs.length === 0) return bySlug;

  const { data, error } = await db
    .from("products")
    .select("id, slug")
    .eq("is_active", true)
    .in("slug", slugs);
  if (error) {
    console.error("[cart-store] product lookup failed:", error.message);
    return bySlug;
  }
  for (const row of data ?? []) bySlug.set(row.slug, row);
  return bySlug;
}

/**
 * Read the caller's full cart, newest line first.
 * Returns null when the database is unavailable (callers answer 503).
 */
export async function readCart(userId: string): Promise<ServerCartLine[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: items, error: itemsError } = await db
    .from("cart_items")
    .select("product_id, quantity, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (itemsError) {
    console.error("[cart-store] cart read failed:", itemsError.message);
    return null;
  }
  const rows: CartItemRow[] = items ?? [];
  if (rows.length === 0) return [];

  const { data: products, error: productsError } = await db
    .from("products")
    .select("id, slug")
    .in(
      "id",
      rows.map((row) => row.product_id),
    );
  if (productsError) {
    console.error("[cart-store] product lookup failed:", productsError.message);
    return null;
  }

  const slugById = new Map((products ?? []).map((row) => [row.id, row.slug]));
  const lines: ServerCartLine[] = [];
  for (const row of rows) {
    const slug = slugById.get(row.product_id);
    if (slug) lines.push({ slug, quantity: row.quantity });
  }
  return lines;
}

/**
 * Replace the caller's cart wholesale with `lines` (already validated).
 * Unknown/inactive slugs are skipped; an empty list clears the cart.
 * Returns the fresh cart, or null on database failure.
 */
export async function replaceCart(
  userId: string,
  lines: ServerCartLine[],
): Promise<ServerCartLine[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;

  const wanted = new Map<string, number>();
  for (const line of lines) wanted.set(line.slug, line.quantity);

  const bySlug = await resolveProductIds([...wanted.keys()]);

  const rows = [...wanted.entries()].flatMap(([slug, quantity]) => {
    const product = bySlug.get(slug);
    return product ? [{ user_id: userId, product_id: product.id, quantity }] : [];
  });

  const { error: deleteError } = await db.from("cart_items").delete().eq("user_id", userId);
  if (deleteError) {
    console.error("[cart-store] cart clear failed:", deleteError.message);
    return null;
  }
  if (rows.length > 0) {
    const { error: insertError } = await db.from("cart_items").insert(rows);
    if (insertError) {
      console.error("[cart-store] cart write failed:", insertError.message);
      return null;
    }
  }
  return readCart(userId);
}

/**
 * Empty the caller's cart. True on success, false when unavailable.
 */
export async function clearCart(userId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  if (!db) return false;
  const { error } = await db.from("cart_items").delete().eq("user_id", userId);
  if (error) {
    console.error("[cart-store] cart clear failed:", error.message);
    return false;
  }
  return true;
}

/**
 * Fold a guest cart into the signed-in cart via the atomic `merge_cart`
 * RPC (sums per line, clamps 1..20, skips unknown/inactive slugs).
 * Returns the merged cart, or null on failure.
 */
export async function mergeGuestCart(
  userId: string,
  guestLines: ServerCartLine[],
): Promise<ServerCartLine[] | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  if (guestLines.length === 0) return readCart(userId);

  const { error } = await db.rpc("merge_cart", {
    p_user_id: userId,
    p_items: JSON.parse(JSON.stringify(guestLines)),
  });
  if (error) {
    console.error("[cart-store] merge failed:", error.message);
    return null;
  }
  return readCart(userId);
}

