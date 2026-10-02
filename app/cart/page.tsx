import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cart",
};

/**
 * Cart page.
 * Phase 1: empty-state shell.
 * Phase 4: renders live cart items from CartContext (localStorage) with
 *          quantity controls, totals and a "Proceed to checkout" button.
 */
export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-brand">
        Your Cart
      </h1>

      <div className="mt-8 rounded-2xl bg-white p-10 ring-1 ring-black/5">
        <p className="text-5xl" aria-hidden>
          🛒
        </p>
        <p className="mt-4 text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-ink/60">
          Browse the menu and add your favourite snacks.
        </p>
        <Link
          href="/#menu"
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Browse the menu
        </Link>
      </div>
    </div>
  );
}
