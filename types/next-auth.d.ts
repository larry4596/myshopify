import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      /** Stable provider id (Google `sub`) — set by the session callback. */
      id: string;
    } & DefaultSession["user"];
  }
}
