"use client";

import { useState } from "react";

type QuantityStepperProps = {
  initial?: number;
  min?: number;
  max?: number;
  /** Called whenever the quantity changes (used by the cart in Phase 4). */
  onChange?: (quantity: number) => void;
};

/**
 * +/- quantity control. Client component because it owns state.
 * Keep it between `min` and `max`; reports changes through `onChange`.
 */
export default function QuantityStepper({
  initial = 1,
  min = 1,
  max = 20,
  onChange,
}: QuantityStepperProps) {
  const [quantity, setQuantity] = useState(initial);

  const update = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    setQuantity(clamped);
    onChange?.(clamped);
  };

  const buttonClass =
    "flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold text-brand transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-white p-1">
      <button
        type="button"
        onClick={() => update(quantity - 1)}
        disabled={quantity <= min}
        className={buttonClass}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <span
        className="w-10 text-center font-bold tabular-nums"
        aria-live="polite"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => update(quantity + 1)}
        disabled={quantity >= max}
        className={buttonClass}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
