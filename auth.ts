import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { userIdFromGoogleSub, upsertUser } from "@/lib/users";

/**
 * Auth.js v5 (NextAuth) configuration — Phase 2, extended in Phase 3.
 *
 * - Google provider reads the credentials documented in `.env.example`
 *   (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` from Google Cloud Console).
 * - `AUTH_SECRET` is read automatically from the environment; it signs the
 *   session JWT so it must never be committed (see `.gitignore`).
 * - JWT session strategy (PRD FR2.3): the session survives browser restarts
 *   without a database session table.
 * - `trustHost` lets Auth.js trust the request host (needed on Vercel and
 *   behind proxies) instead of requiring AUTH_URL.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    // Custom branded sign-in page instead of Auth.js's default.
    signIn: "/signin",
  },
  callbacks: {
    /**
     * PRD FR2.4: sync the signed-in user into `public.users`.
     * Idempotent upsert; never blocks sign-in (upsertUser swallows errors),
     * because auth must keep working even if the database hiccups.
     */
    async signIn({ user, account }) {
      if (account?.provider === "google" && account.providerAccountId && user.email) {
        await upsertUser({
          id: userIdFromGoogleSub(account.providerAccountId),
          email: user.email,
          name: user.name,
          image: user.image,
        });
      }
      return true;
    },
    /**
     * Expose the database user id on the session (Phase 3): a deterministic
     * UUIDv5 of the Google `sub` — see lib/users.ts for the rationale.
     */
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = userIdFromGoogleSub(token.sub);
      }
      return session;
    },
  },
});
