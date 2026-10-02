import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /**
       * Database user id (`public.users.id`, uuid) — derived deterministically
       * from the Google sub (see lib/users.ts). Set by the session callback.
       */
      id: string;
    } & DefaultSession["user"];
  }
}
