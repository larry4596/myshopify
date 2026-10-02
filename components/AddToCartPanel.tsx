"use client";

import { useState } from "react";
import QuantityStepper from "@/components/QuantityStepper";
import AddToCartButton from "@/components/AddToCartButton";

/**
 * Product detail buy box (PRD FR1.3 / FR4.1): quantity selector + add-to-cart
 * sharing one piece of state. Client component so the chosen quantity can be
 * handed to the cart.
 */
export default function AddToCartPanel({
  slug,
  buttonClassName,
}: {
  slug: string;
  /** Kept as a prop so the page keeps owning the layout classes. */
  buttonClassName: string;
}) {
  const [quantity, setQuantity] = useState(1);

  return (
    <>
      <div className="mt-6">
        <p className="text-sm font-semibold text-ink/70">Quantity</p>
        <div className="mt-2">
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>
      </div>

      <AddToCartButton
        slug={slug}
        quantity={quantity}
        className={buttonClassName}
      />
    </>
  );
}