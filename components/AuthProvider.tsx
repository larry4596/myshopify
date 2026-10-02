"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client-side Auth.js session context.
 *
 * Lives in the root layout so any client component (the header auth menu)
 * can read the session with `useSession()`. Kept out of server components on
 * purpose: reading the session here (client fetch of /api/auth/session) lets
 * static pages like the home page and product details stay pre-rendered.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
