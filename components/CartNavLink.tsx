"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";

/**
 * Header "Cart" link with a live item-count badge (PRD FR4.1).
 *
 * The badge only renders once the cart has been read from localStorage, which
 * keeps the server HTML and the first client render identical (no hydration
 * mismatch) at the cost of a brief badge-less paint.
 */
export default function CartNavLink({ className = "" }: { className?: string }) {
  const { itemCount, hydrated } = useCart();
  const showBadge = hydrated && itemCount > 0;

  return (
    <Link href="/cart" className={`relative inline-flex items-center gap-1.5 ${className}`}>
      Cart
      {showBadge && (
        <span
          className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-xs font-bold text-ink"
          aria-label={`${itemCount} ${itemCount === 1 ? "item" : "items"} in your cart`}
        >
          {itemCount}
        </span>
      )}
    </Link>
  );
}