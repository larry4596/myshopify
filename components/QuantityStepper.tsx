"use client";

import { useState } from "react";

type QuantityStepperProps = {
  /** Starting quantity when the stepper owns its own state. */
  initial?: number;
  min?: number;
  max?: number;
  /**
   * Controlled value. When provided the stepper renders it as-is (the parent
   * owns the state) — used by the cart, where a line can also be changed by
   * removing it. Omit it for the uncontrolled product-page behaviour.
   */
  value?: number;
  /** Called whenever the quantity changes (used by cart + product page). */
  onChange?: (quantity: number) => void;
};

/**
 * +/- quantity control. Client component because it owns state.
 * Keeps the value between `min` and `max` and reports changes via `onChange`.
 */
export default function QuantityStepper({
  initial = 1,
  min = 1,
  max = 20,
  value,
  onChange,
}: QuantityStepperProps) {
  const [uncontrolled, setUncontrolled] = useState(initial);
  const isControlled = value !== undefined;
  const quantity = isControlled ? value : uncontrolled;

  const update = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    if (!isControlled) setUncontrolled(clamped);
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
