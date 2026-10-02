import { handlers } from "@/auth";

/**
 * Auth.js route handler — handles everything under /api/auth/*
 * (signin, signout, callback, session, csrf, ...).
 */
export const { GET, POST } = handlers;
