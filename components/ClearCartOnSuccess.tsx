"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";
import { clearPendingPayment } from "@/lib/pending-payment";

/**
 * Empties the cart once, after a verified payment lands on the success page
 * (PRD FR4.5: "clear the cart" only after Paystack confirms success).
 *
 * Also clears any development-only "pending local payment" notice: the order
 * exists now, so the manual verify link has done its job.
 *
 * Runs after hydration so it can never wipe storage before it has been read.
 */
export default function ClearCartOnSuccess() {
  const { clearCart, hydrated } = useCart();

  useEffect(() => {
    if (!hydrated) return;
    clearCart();
    clearPendingPayment();
  }, [hydrated, clearCart]);

  return null;
}