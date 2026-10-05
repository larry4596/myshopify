import { NextResponse } from "next/server";

import { clearCart, readCart } from "@/lib/cart-store";
import { resolveUser } from "@/lib/resolve-user";

/**
 * Lesson 3 P3 — GET /api/cart (PRD-LESSON3 §7.2).
 *
 * Shared by the web and the app (byte-identical URL, A4): `resolveUser()`
 * decides who is asking from the Auth.js cookie or the Bearer token.
 * Signed-out callers get 401 — the guest cart stays local on each device.
 */
export async function GET(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Sign in to sync your basket." }, { status: 401 });
  }

  const lines = await readCart(user.id);
  if (!lines) {
    return NextResponse.json(
      { message: "Basket unavailable — check your connection and try again." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { lines, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}


/**
 * Lesson 3 P3 — DELETE /api/cart (PRD-LESSON3 §7.3).
 *
 * Empties the caller's cart ("clear basket"), on either platform.
 */
export async function DELETE(request: Request) {
  const user = await resolveUser(request);
  if (!user) {
    return NextResponse.json({ message: "Sign in to sync your basket." }, { status: 401 });
  }

  const ok = await clearCart(user.id);
  if (!ok) {
    return NextResponse.json(
      { message: "Basket unavailable — check your connection and try again." },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { lines: [], updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
