import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata: Metadata = {
  title: "Checkout",
};

/**
 * Checkout page (FR2.5: sign-in required; FR4.3: delivery form + summary +
 * Paystack).
 *
 * Unauthenticated visitors are sent to /signin and come back here afterwards
 * via `callbackUrl`. Paystack's callback returns here too, with a readable
 * `?error=` code when a payment fails or is cancelled (FR4.6).
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/checkout")}`);
  }

  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-brand">
        Checkout
      </h1>
      <p className="mt-2 text-center text-sm text-ink/60">
        Signed in as{" "}
        <span className="font-medium text-ink/70">{session.user.email}</span>.
      </p>

      <CheckoutForm
        user={{ name: session.user.name ?? null, email: session.user.email ?? null }}
        errorCode={error}
      />

      <p className="mt-8 text-center text-xs text-ink/50">
        Need to change something?{" "}
        <Link href="/cart" className="font-medium text-brand hover:underline">
          Back to cart
        </Link>
      </p>
    </div>
  );
}
