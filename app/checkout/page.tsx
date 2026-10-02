import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "Checkout",
};

/**
 * Checkout page (FR2.5: sign-in required).
 * Unauthenticated visitors are sent to /signin and returned here after
 * signing in via `callbackUrl`.
 *
 * Phase 1: empty-state shell.
 * Phase 4: delivery form (name, phone, address, notes) + order summary +
 *          Paystack Test Mode payment.
 */
export default async function CheckoutPage() {
  const session = await auth();
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/checkout")}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-brand">
        Checkout
      </h1>

      <div className="mt-8 rounded-2xl bg-white p-10 ring-1 ring-black/5">
        <p className="text-5xl" aria-hidden>
          🧾
        </p>
        <p className="mt-4 text-lg font-semibold">Nothing to check out yet</p>
        <p className="mt-1 text-sm text-ink/60">
          Add items to your cart first, then come back to check out.
        </p>
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
