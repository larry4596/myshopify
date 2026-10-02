"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

/**
 * Empties the cart once, after a verified payment lands on the success page
 * (PRD FR4.5: "clear the cart" only after Paystack confirms success).
 *
 * Runs after hydration so it can never wipe storage before it has been read.
 */
export default function ClearCartOnSuccess() {
  const { clearCart, hydrated } = useCart();

  useEffect(() => {
    if (!hydrated) return;
    clearCart();
  }, [hydrated, clearCart]);

  return null;
}