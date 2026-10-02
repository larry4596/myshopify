"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import QuantityStepper from "@/components/QuantityStepper";
import { formatNaira, getProductBySlug } from "@/lib/products";

/**
 * Cart contents (PRD FR4.2): change quantities, remove lines, see the total,
 * then proceed to checkout.
 *
 * Prices are looked up from the catalog at render time — the cart itself only
 * stores slug + quantity, and the server re-prices everything before charging
 * (FR4.7).
 */
export default function CartView() {
  const { lines, hydrated, setQuantity, removeItem, clearCart } = useCart();

  // Until localStorage has been read we can't know if the cart is empty, so
  // show a placeholder rather than a misleading "empty cart" state.
  if (!hydrated) {
    return (
      <div className="mt-8 space-y-4" aria-hidden>
        {[0, 1].map((row) => (
          <div
            key={row}
            className="h-28 animate-pulse rounded-2xl bg-white ring-1 ring-black/5"
          />
        ))}
      </div>
    );
  }

  // Join with the catalog; a slug that is no longer sold is simply skipped.
  const items = lines.flatMap((line) => {
    const product = getProductBySlug(line.slug);
    return product ? [{ product, quantity: line.quantity }] : [];
  });

  if (items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl bg-white p-10 text-center ring-1 ring-black/5">
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
    );
  }

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const totalKobo = items.reduce(
    (total, item) => total + item.product.priceKobo * item.quantity,
    0,
  );

  return (
    <div className="mt-8">
      <ul className="space-y-4">
        {items.map(({ product, quantity }) => (
          <li
            key={product.slug}
            className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-black/5"
          >
            <Image
              src={product.imageUrl}
              alt={product.name}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-xl bg-brand-light object-cover"
            />

            <div className="min-w-[9rem] flex-1">
              <h2 className="font-bold leading-snug text-brand">
                <Link
                  href={`/products/${product.slug}`}
                  className="hover:underline"
                >
                  {product.name}
                </Link>
              </h2>
              <p className="mt-0.5 text-sm text-ink/60">
                {formatNaira(product.priceKobo)} each
              </p>
              <button
                type="button"
                onClick={() => removeItem(product.slug)}
                className="mt-1 text-xs font-semibold text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>

            <QuantityStepper
              value={quantity}
              onChange={(next) => setQuantity(product.slug, next)}
            />

            <p className="ml-auto w-24 shrink-0 text-right font-extrabold text-brand">
              {formatNaira(product.priceKobo * quantity)}
            </p>
          </li>
        ))}
      </ul>

      {/* Totals + next step */}
      <div className="mt-8 rounded-2xl bg-white p-5 ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink/70">
            Total ({itemCount} {itemCount === 1 ? "item" : "items"})
          </span>
          <span className="text-2xl font-extrabold text-brand">
            {formatNaira(totalKobo)}
          </span>
        </div>

        <Link
          href="/checkout"
          className="mt-4 block rounded-full bg-brand px-6 py-3.5 text-center font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Proceed to checkout
        </Link>

        <div className="mt-3 flex items-center justify-between text-sm">
          <Link href="/#menu" className="font-medium text-brand hover:underline">
            ← Continue shopping
          </Link>
          <button
            type="button"
            onClick={clearCart}
            className="font-medium text-ink/50 hover:underline"
          >
            Clear cart
          </button>
        </div>
      </div>
    </div>
  );
}