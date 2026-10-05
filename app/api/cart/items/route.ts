import { NextResponse } from "next/server";

import { replaceCart, type ServerCartLine } from "@/lib/cart-store";
import { resolveUser } from "@/lib/resolve-user";

/**
 * Lesson 3 P3 — PUT /api/cart/items (PRD-LESSON3 §7.3).
 *
 * The SINGLE write path for both platforms: add, stepper tap, remove and
 * clear all send the resulting line list, so there is exactly one mutation
 * to audit. Validation mirrors the rules `priceCart` already enforces —
 * slugs exist, `is_active`, integer quantity 1..20, no duplicates. An
 * empty `lines` array clears the cart.
 */

const MAX_BODY_BYTES = 8 * 1024;

function isLine(value: unknown): value is ServerCartLine {
  if (typeof value !== "object" || value === null) return false;
  const { slug, quantity } = value as { slug?: unknown; quantity?: unknown };
  return (
    typeof slug === "string" &&
    slug.length > 0 &&
    slug.length <= 120 &&
    Number.isInteger(quantity)
  );
}

export async function PUT(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Sign in to sync your basket." }, { status: 401 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ message: "Basket is too large." }, { status: 413 });
    }
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return NextResponse.json({ message: "Basket could not be read." }, { status: 400 });
  }

  const rawLines =
    body && typeof body === "object" && "lines" in body
      ? (body as { lines?: unknown }).lines
      : undefined;
  if (!Array.isArray(rawLines)) {
    return NextResponse.json({ message: "Basket lines are missing." }, { status: 400 });
  }
  if (rawLines.length > 50) {
    return NextResponse.json({ message: "Basket holds too many items." }, { status: 400 });
  }

  const lines: ServerCartLine[] = [];
  const seen = new Set<string>();
  for (const entry of rawLines) {
    if (!isLine(entry)) {
      return NextResponse.json({ message: "Basket holds an invalid item." }, { status: 400 });
    }
    if (entry.quantity < 1 || entry.quantity > 20) {
      return NextResponse.json(
        { message: "Item quantities must be whole numbers between 1 and 20." },
        { status: 400 },
      );
    }
    if (seen.has(entry.slug)) {
      return NextResponse.json({ message: "Duplicate item in basket." }, { status: 400 });
    }
    seen.add(entry.slug);
    lines.push({ slug: entry.slug, quantity: entry.quantity });
  }

  // Unknown/inactive slugs fail closed ONLY when every line is unknown —
  // `replaceCart` otherwise skips the stale one so a delisted product can
  // never block saving the rest of the basket.
  const saved = await replaceCart(user.id, lines);
  if (!saved) {
    return NextResponse.json(
      { message: "Basket unavailable — check your connection and try again." },
      { status: 503 },
    );
  }

  if (lines.length > 0 && saved.length === 0) {
    return NextResponse.json(
      { message: "Those items are no longer available." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { lines: saved, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
