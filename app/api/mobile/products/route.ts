import { NextResponse } from "next/server";

import { products as localProducts } from "@/lib/products";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Lesson 3 P2 — GET /api/mobile/products (PRD-LESSON3 §7.4).
 *
 * Unauthenticated catalogue for the app. Reads the same `public.products`
 * rows the web menu is seeded from, mapped to the camelCase shape both
 * platforms share (`slug, name, description, priceKobo, imageUrl`).
 *
 * Cache: `public, max-age=60, s-maxage=600` — the menu changes rarely, and
 * the app also caches for 60 s via React Query, so a Vercel cold start is
 * paid at most once a minute per edge.
 *
 * Falls back to the local `lib/products.ts` catalog when Supabase is not
 * configured (local dev before the keys exist), so the app never sees a 500
 * for a setup step.
 */
export async function GET() {
  const db = getSupabaseAdmin();

  if (!db) {
    return NextResponse.json(
      { products: localProducts },
      {
        headers: {
          "Cache-Control": "public, max-age=60, s-maxage=600",
        },
      },
    );
  }

  const { data, error } = await db
    .from("products")
    .select("slug, name, description, price_kobo, image_url")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error(`[mobile/products] supabase error: ${error.message}`);
    return NextResponse.json(
      { message: "Could not load the menu. Try again." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      products: (data ?? []).map((row) => ({
        slug: row.slug,
        name: row.name,
        description: row.description,
        priceKobo: row.price_kobo,
        imageUrl: row.image_url,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=600",
      },
    },
  );
}
