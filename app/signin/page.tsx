import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SignInButton from "@/components/SignInButton";

export const metadata: Metadata = {
  title: "Sign in",
};

/**
 * Only allow same-origin absolute paths as post-sign-in destinations so the
 * `callbackUrl` query param can never bounce users to another site.
 */
function sanitizeCallbackUrl(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/";
}

/**
 * Branded sign-in page (Auth.js `pages.signIn`).
 *
 * - Already signed in? Go straight to the requested page.
 * - Reached via `?callbackUrl=...` (protected pages) -> return there after
 *   the Google round-trip.
 * - Auth.js appends `?error=...` on failed sign-ins -> show a friendly note.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;
  const safeCallback = sanitizeCallbackUrl(callbackUrl);

  const session = await auth();
  if (session) redirect(safeCallback);

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-black/5 sm:p-10">
        <p className="text-4xl" aria-hidden>
          🍢
        </p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
          Sign in to NaijaBites
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink/60">
          Use your Google account to sign in. You&apos;ll need to be signed in
          to check out and see your order history.
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            Sign-in didn&apos;t complete. Please try again.
          </p>
        )}

        <div className="mt-6">
          <SignInButton callbackUrl={safeCallback} />
        </div>

        <p className="mt-6 text-xs text-ink/50">
          We only use your name, email and profile photo — no passwords stored.
        </p>

        <Link
          href="/"
          className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
        >
          ← Back to the shop
        </Link>
      </div>
    </div>
  );
}
