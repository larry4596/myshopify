"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";

/**
 * "Add to cart" button — Phase 4 (PRD FR4.1: add from the listing page or the
 * detail page). Client component because it talks to the cart context.
 *
 * Gives brief in-place feedback ("Added ✓") instead of a toast so no extra
 * dependency or portal is needed.
 */
export default function AddToCartButton({
  slug,
  quantity = 1,
  label = "Add to cart",
  className = "",
}: {
  slug: string;
  quantity?: number;
  label?: string;
  className?: string;
}) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  // Reset the confirmation shortly after, so the button stays reusable.
  useEffect(() => {
    if (!justAdded) return;
    const timeout = setTimeout(() => setJustAdded(false), 1500);
    return () => clearTimeout(timeout);
  }, [justAdded]);

  return (
    <button
      type="button"
      onClick={() => {
        addItem(slug, quantity);
        setJustAdded(true);
      }}
      className={className}
      aria-live="polite"
    >
      {justAdded ? "Added ✓" : label}
    </button>
  );
}