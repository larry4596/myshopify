"use client";

import type { PendingPayment } from "@/lib/pending-payment";

/**
 * Development-only notice: Paystack will not send a browser back to
 * `http://localhost`, so a local payment has to be finished by hand.
 *
 * Renders nothing when there is no pending payment, so the checkout page can
 * include it unconditionally in every branch (loading, empty cart, full form) —
 * the link must stay reachable even if the cart has since been emptied.
 */
export default function LocalPaymentNotice({
  payment,
  onDismiss,
}: {
  payment: PendingPayment | null;
  onDismiss: () => void;
}) {
  if (!payment) return null;

  return (
    <div className="mb-6 rounded-2xl border-2 border-dashed border-gold bg-white p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-gold-dark">
        Local testing — Paystack can&apos;t redirect back here
      </p>

      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        Paystack refuses to send a browser back to{" "}
        <code className="font-mono text-xs">localhost</code>, so this payment
        will <strong>not</strong> return to the store on its own. Finish it in
        two steps — the order is only created on the second one.
      </p>

      <ol className="mt-4 space-y-4 text-sm leading-relaxed text-ink/70">
        <li>
          <span className="font-bold text-brand">1.</span> Pay on the Paystack
          page:{" "}
          <a
            href={payment.authorizationUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand underline"
          >
            open the Paystack checkout in a new tab ↗
          </a>
          <span className="mt-1 block text-xs text-ink/50">
            Test card <span className="font-mono">4084 0840 8408 4081</span> ·
            CVV <span className="font-mono">408</span> · any future expiry · PIN{" "}
            <span className="font-mono">0000</span> · OTP{" "}
            <span className="font-mono">123456</span>
          </span>
        </li>

        <li>
          <span className="font-bold text-brand">2.</span> Come back to this tab
          and open the verify link — this is what creates your order:
          <a
            href={payment.verifyUrl}
            className="mt-2 block break-all rounded-xl bg-brand-light px-4 py-3 font-mono text-xs font-semibold text-brand underline"
          >
            {payment.verifyUrl}
          </a>
        </li>
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={payment.verifyUrl}
          className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          I&apos;ve paid — create my order
        </a>
        <button
          type="button"
          onClick={onDismiss}
          className="text-sm font-medium text-ink/50 hover:underline"
        >
          Dismiss
        </button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/50">
        Paystack reference{" "}
        <span className="font-mono">{payment.reference}</span>. To get normal
        redirects locally, set{" "}
        <code className="font-mono">NEXT_PUBLIC_SITE_URL</code> to an https
        tunnel (<code className="font-mono">ngrok http 3000</code>) and restart
        the dev server — this notice never appears in production.
      </p>
    </div>
  );
}