import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js v5 (NextAuth) configuration — Phase 2.
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
     * Expose the provider's stable user id (Google `sub`) on the session so
     * later phases can key server-side data to the signed-in user.
     */
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
