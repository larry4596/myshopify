"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import LocalPaymentNotice from "@/components/LocalPaymentNotice";
import {
  clearPendingPayment,
  readPendingPayment,
  savePendingPayment,
  type PendingPayment,
} from "@/lib/pending-payment";
import { formatNaira, getProductBySlug } from "@/lib/products";

/**
 * Checkout form (PRD FR4.3) — delivery details + order summary + "Pay with
 * Paystack".
 *
 * Flow: this form POSTs the cart (slugs + quantities only) and the delivery
 * details to /api/paystack/initialize; the server re-prices everything, creates
 * the Paystack transaction and answers with an `authorizationUrl`, which we
 * hand the browser over to. Paystack then redirects back to
 * /api/paystack/verify, which verifies the payment and creates the order
 * (FR4.4 / FR4.5). No secret ever reaches this component.
 */

/** Remembered between visits so a returning customer doesn't retype it. */
const DELIVERY_DRAFT_KEY = "naijabites:delivery-draft:v1";

const GENERIC_ERROR =
  "Something went wrong starting your payment. Please try again.";

/**
 * Friendly copy for the `?error=` codes the Paystack routes redirect back with.
 * FR4.6: a failed or cancelled payment returns the customer here with a message.
 */
const errorMessages: Record<string, string> = {
  not_configured:
    "Payments aren't set up yet — add the Paystack test keys to .env.local and restart the dev server.",
  missing_reference:
    "Paystack didn't send a payment reference back, so nothing was charged. Please try again.",
  verify_failed:
    "We couldn't confirm that payment with Paystack, so no order was created. Nothing was charged.",
  payment_failed:
    "That payment didn't go through, so no order was created. You can try again.",
  amount_mismatch:
    "The amount Paystack confirmed didn't match your cart, so we stopped before creating an order. Nothing was charged.",
  session_mismatch:
    "That payment belongs to a different sign-in session. Please sign in again and retry.",
  order_failed:
    "Your payment was confirmed but we couldn't save the order. Please contact us with your Paystack reference.",
};

type DeliveryDraft = { phone: string; address: string; notes: string };

/** localStorage only — read in an effect, never during render. */
function readDeliveryDraft(): DeliveryDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DELIVERY_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeliveryDraft>;
    return {
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    return null; // corrupt JSON — just ask for the details again
  }
}

function saveDeliveryDraft(draft: DeliveryDraft): void {
  try {
    window.localStorage.setItem(DELIVERY_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Private mode / quota — the order still goes through.
  }
}

const inputClass =
  "mt-1 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";
const labelClass = "block text-sm font-semibold text-ink/70";

export default function CheckoutForm({
  user,
  errorCode,
}: {
  user: { name: string | null; email: string | null };
  /** `?error=` handed back by the Paystack routes (FR4.6). */
  errorCode?: string;
}) {
  const { lines, hydrated } = useCart();
  const [form, setForm] = useState({
    name: user.name ?? "",
    phone: "",
    address: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  /** Development only: a payment Paystack can't redirect back (see the notice). */
  const [manual, setManual] = useState<PendingPayment | null>(null);

  // Prefill from the last checkout (client-only, so no hydration mismatch).
  useEffect(() => {
    const draft = readDeliveryDraft();
    if (!draft) return;
    setForm((current) => ({
      ...current,
      phone: current.phone || draft.phone,
      address: current.address || draft.address,
      notes: current.notes || draft.notes,
    }));
  }, []);

  // A local payment may still be waiting to be finished by hand — the notice
  // has to survive the trip to Paystack's tab, a refresh, or an emptied cart.
  useEffect(() => {
    setManual(readPendingPayment());
  }, []);

  const dismissManual = () => {
    clearPendingPayment();
    setManual(null);
  };

  const routeError = errorCode
    ? (errorMessages[errorCode] ?? GENERIC_ERROR)
    : null;
  const message = submitError ?? routeError;

  const items = lines.flatMap((line) => {
    const product = getProductBySlug(line.slug);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const totalKobo = items.reduce(
    (total, item) => total + item.product.priceKobo * item.quantity,
    0,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (lines.length === 0) {
      setSubmitError("Your cart is empty — add something from the menu first.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines,
          customerName: form.name,
          customerPhone: form.phone,
          address: form.address,
          notes: form.notes,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        authorizationUrl?: string;
        message?: string;
        detail?: string;
        reference?: string;
        manualCallback?: { verifyUrl?: string } | null;
      } | null;

      if (!response.ok || !payload?.authorizationUrl) {
        // Prefer the actionable `detail` (e.g. the https/localhost requirement)
        // over the short headline.
        setSubmitError(payload?.detail ?? payload?.message ?? GENERIC_ERROR);
        setSubmitting(false);
        return;
      }

      saveDeliveryDraft({
        phone: form.phone,
        address: form.address,
        notes: form.notes,
      });

      // Development with a localhost callback: Paystack will take the payment
      // but never redirect back, so DON'T navigate away — this page holds the
      // verify link the customer has to open by hand (FR4.5 locally).
      const verifyUrl = payload.manualCallback?.verifyUrl;
      if (verifyUrl && payload.reference) {
        const pending: PendingPayment = {
          reference: payload.reference,
          authorizationUrl: payload.authorizationUrl,
          verifyUrl,
          createdAt: Date.now(),
        };
        savePendingPayment(pending);
        setManual(pending);
        setSubmitting(false);
        return;
      }

      // Off to Paystack. `submitting` stays true so the button can't be
      // pressed twice while the browser navigates away.
      window.location.assign(payload.authorizationUrl);
    } catch {
      setSubmitError(
        "We couldn't reach the payment service. Check your connection and try again.",
      );
      setSubmitting(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="mt-8">
        <LocalPaymentNotice payment={manual} onDismiss={dismissManual} />
        <div className="h-64 animate-pulse rounded-2xl bg-white ring-1 ring-black/5" aria-hidden />
      </div>
    );
  }

  // Nothing to pay for — send them shopping instead of to Paystack (FR4.3).
  // A pending local payment is still shown above, so the verify link stays
  // reachable even after the cart has been emptied.
  if (items.length === 0) {
    return (
      <div className="mt-8">
        <LocalPaymentNotice payment={manual} onDismiss={dismissManual} />
        <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-black/5">
        <p className="text-5xl" aria-hidden>
          🧾
        </p>
        <p className="mt-4 text-lg font-semibold">Nothing to check out yet</p>
        <p className="mt-1 text-sm text-ink/60">
          Add items to your cart first, then come back to check out.
        </p>
        {message && (
          <p
            role="alert"
            className="mx-auto mt-4 max-w-md rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {message}
          </p>
        )}
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

  return (
    <div className="mt-8">
      <LocalPaymentNotice payment={manual} onDismiss={dismissManual} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* Delivery details (FR4.3) */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6"
      >
        <h2 className="text-lg font-extrabold text-brand">Delivery details</h2>

        {message && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {message}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label className={labelClass} htmlFor="customer-name">
              Full name
            </label>
            <input
              id="customer-name"
              name="name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="customer-phone">
              Phone number
            </label>
            <input
              id="customer-phone"
              name="phone"
              type="tel"
              required
              minLength={7}
              maxLength={20}
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 000 0000"
              value={form.phone}
              onChange={(event) =>
                setForm((current) => ({ ...current, phone: event.target.value }))
              }
              className={inputClass}
            />
            <p className="mt-1 text-xs text-ink/50">
              The rider calls this number on delivery day.
            </p>
          </div>

          <div>
            <label className={labelClass} htmlFor="customer-address">
              Delivery address
            </label>
            <textarea
              id="customer-address"
              name="address"
              required
              minLength={10}
              maxLength={300}
              rows={3}
              autoComplete="street-address"
              placeholder="12 Allen Avenue, Ikeja, Lagos"
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  address: event.target.value,
                }))
              }
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="customer-notes">
              Delivery notes{" "}
              <span className="font-normal text-ink/40">(optional)</span>
            </label>
            <textarea
              id="customer-notes"
              name="notes"
              rows={2}
              maxLength={500}
              placeholder="Ring the bell, the gate is on the left…"
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-full bg-brand px-6 py-3.5 font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Taking you to Paystack…" : "Pay with Paystack"}
        </button>

        <p className="mt-3 text-center text-xs leading-relaxed text-ink/50">
          You&apos;ll be redirected to Paystack&apos;s secure checkout. We
          charge exactly the total shown here — in kobo, no hidden fees.
        </p>
      </form>

      {/* Order summary — prices from the catalog; the server re-prices before
          charging, so the amount verified with Paystack is always the truth. */}
      <aside className="h-fit rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
        <h2 className="text-lg font-extrabold text-brand">Order summary</h2>

        <ul className="mt-4 space-y-3 border-b border-black/5 pb-4 text-sm">
          {items.map(({ product, quantity }) => (
            <li
              key={product.slug}
              className="flex items-baseline justify-between gap-4"
            >
              <span className="text-ink/70">
                {product.name} <span className="text-ink/40">× {quantity}</span>
              </span>
              <span className="shrink-0 font-medium">
                {formatNaira(product.priceKobo * quantity)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink/70">Total</span>
          <span className="text-2xl font-extrabold text-brand">
            {formatNaira(totalKobo)}
          </span>
        </div>

        <p className="mt-4 border-t border-black/5 pt-4 text-xs leading-relaxed text-ink/50">
          Your confirmation email goes to{" "}
          <span className="font-semibold text-ink/70">
            {user.email ?? "your Google account"}
          </span>
          .
        </p>

        {/* Test Mode helper — flip to live keys and delete this once the store
            goes live (PRD §11: Paystack stays in Test Mode for the project). */}
        <div className="mt-4 rounded-xl bg-brand-light p-4 text-xs leading-relaxed text-brand">
          <p className="font-bold uppercase tracking-wide">Paystack Test Mode</p>
          <p className="mt-1">
            Test card <span className="font-mono">4084 0840 8408 4081</span> ·
            CVV <span className="font-mono">408</span> · any future expiry · PIN{" "}
            <span className="font-mono">0000</span> · OTP{" "}
            <span className="font-mono">123456</span>. No real money moves.
          </p>
        </div>

        <Link
          href="/cart"
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          ← Back to cart
        </Link>
      </aside>
      </div>
    </div>
  );
}