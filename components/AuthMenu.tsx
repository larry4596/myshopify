"use client";

import Image from "next/image";
import { signIn, signOut, useSession } from "next-auth/react";

/** The four-colour Google "G" mark (inline so it scales with text). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}

/**
 * Header auth area — Phase 2 (FR2.1 / FR2.2).
 *
 * - loading  -> neutral skeleton (avoids a sign-in button flash)
 * - signed out -> "Sign in with Google" (starts the Auth.js Google flow,
 *                 returning to the page the visitor is currently on)
 * - signed in -> avatar + name + "Sign out"
 */
export default function AuthMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div
        className="h-9 w-36 animate-pulse rounded-full bg-brand/10"
        aria-hidden="true"
      />
    );
  }

  if (!session?.user) {
    return (
      <button
        type="button"
        onClick={() =>
          signIn("google", {
            callbackUrl:
              typeof window !== "undefined"
                ? window.location.pathname + window.location.search
                : "/",
          })
        }
        className="flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
      >
        <GoogleIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in with Google</span>
        <span className="sm:hidden">Sign in</span>
      </button>
    );
  }

  const { user } = session;
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-3">
      {user.image ? (
        <Image
          src={user.image}
          alt={user.name ?? "Your account"}
          width={32}
          height={32}
          className="rounded-full ring-2 ring-gold"
        />
      ) : (
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-white ring-2 ring-gold"
          aria-hidden="true"
        >
          {initial}
        </div>
      )}
      <span className="hidden max-w-[12ch] truncate text-sm font-medium text-ink/70 md:inline">
        {user.name ?? user.email}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-full border border-brand/30 px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-light"
      >
        Sign out
      </button>
    </div>
  );
}
