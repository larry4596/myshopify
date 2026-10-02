import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrdersForUser } from "@/lib/orders";
import OrderCard from "@/components/OrderCard";

export const metadata: Metadata = {
  title: "My Orders",
};

/**
 * Orders page — the most important page for HNG's persistence test.
 *
 * Phase 2 (FR2.5): requires sign-in — visitors are redirected to /signin
 * and brought back here afterwards.
 * Phase 3 (FR3.3/FR3.4): lists this user's orders from Supabase (server-side,
 * never localStorage), so they remain visible after logout / closing the
 * browser / re-login on any device (PRD G2, G4).
 */
export default async function OrdersPage() {
  const session = await auth();
  if (!session) {
    redirect(`/signin?callbackUrl=${encodeURIComponent("/orders")}`);
  }

  const result = await getOrdersForUser(session.user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-brand">
        My Orders
      </h1>

      {/* Not configured: tell the user exactly how to finish Phase 3 setup */}
      {result.status === "unconfigured" && (
        <div className="mt-8 rounded-2xl bg-white p-8 text-center ring-1 ring-black/5 sm:p-10">
          <p className="text-4xl" aria-hidden>
            🗄️
          </p>
          <h2 className="mt-4 text-xl font-extrabold text-brand">
            Database not connected yet
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/60">
            Order history lives in Supabase. Four quick steps to connect it:
          </p>
          <ol className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm text-ink/70">
            <li>
              <span className="font-bold text-gold-dark">1.</span> Create a
              project at supabase.com (free tier is fine).
            </li>
            <li>
              <span className="font-bold text-gold-dark">2.</span> SQL Editor →
              run <code className="font-mono">supabase/schema.sql</code>, then{" "}
              <code className="font-mono">supabase/seed.sql</code>.
            </li>
            <li>
              <span className="font-bold text-gold-dark">3.</span> Copy the{" "}
              <strong>Project URL</strong> and the{" "}
              <strong>secret key</strong> (<code className="font-mono">sb_secret_…</code>)
              into <code className="font-mono">.env.local</code>.
            </li>
            <li>
              <span className="font-bold text-gold-dark">4.</span> Restart the
              dev server.
            </li>
          </ol>
          <p className="mt-5 text-xs text-ink/50">
            See README → “Supabase setup (Phase 3)” for screenshots of where
            each value lives.
          </p>
        </div>
      )}

      {/* Query failed: generic message, details already logged server-side */}
      {result.status === "error" && (
        <div
          role="alert"
          className="mt-8 rounded-2xl bg-white p-8 text-center ring-1 ring-black/5"
        >
          <p className="text-4xl" aria-hidden>
            ⚠️
          </p>
          <h2 className="mt-4 text-xl font-extrabold text-brand">
            Couldn&apos;t load your orders
          </h2>
          <p className="mt-2 text-sm text-ink/60">
            Something went wrong talking to the database. Please try again.
          </p>
          <Link
            href="/orders"
            className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Try again
          </Link>
        </div>
      )}

      {/* Signed in, connected, but no orders yet */}
      {result.status === "ok" && result.orders.length === 0 && (
        <div className="mt-8 rounded-2xl bg-white p-10 text-center ring-1 ring-black/5">
          <p className="text-5xl" aria-hidden>
            📦
          </p>
          <p className="mt-4 text-lg font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-ink/60">
            Place your first order — it will stay with your account on any
            device.
          </p>
          <Link
            href="/#menu"
            className="mt-6 inline-block rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Browse the menu
          </Link>
        </div>
      )}

      {/* The history itself (FR3.4) */}
      {result.status === "ok" && result.orders.length > 0 && (
        <div className="mt-8 space-y-4">
          {result.orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}
