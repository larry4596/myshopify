import type { Metadata } from "next";
import CartView from "@/components/CartView";

export const metadata: Metadata = {
  title: "Cart",
};

/**
 * Cart page (PRD FR4.2).
 *
 * Works signed-out — the cart lives in localStorage (via CartProvider) so it
 * survives refreshes. Prices are always resolved from the catalog, and the
 * server re-prices everything again before taking payment (FR4.7).
 */
export default function CartPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-brand">
        Your Cart
      </h1>

      <CartView />
    </div>
  );
}
