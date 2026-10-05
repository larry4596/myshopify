import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api } from './api';
import { API_BASE_URL, isApiConfigured } from './config';
import type { SessionResponse } from './types';

/**
 * Browser-based Google sign-in (PRD-LESSON3 §4, FR-M1.1–M1.3).
 *
 * The app NEVER talks to Google directly and holds no OAuth client id — it
 * opens the store's own Auth.js login in a real Chrome Custom Tab:
 *
 *   openAuthSessionAsync(
 *     GET /api/mobile/auth/start?redirect_uri=<allow-listed deep link>,
 *     redirect_uri
 *   )
 *     → Google consent (the web app's flow, the web app's client)
 *     → /api/mobile/auth/finish sets a 60 s single-use code
 *     → 302 redirect_uri?code=… closes the Custom Tab and lands back here
 *     → POST /api/mobile/auth/exchange { code } → 30-day token → SecureStore
 *
 * Two redirect shapes exist and BOTH are allow-listed server-side:
 *   • `naijabites://`              — dev build / release APK
 *   • `exp://<metro-host>:<port>`  — Expo Go (its scheme is `exp`, and
 *     Linking.createURL('') produces exactly the running app's origin)
 *
 * Because the sub crossing this bridge belongs to the web's Google OAuth
 * client, the exchange mints a token for the SAME `public.users.id` the
 * website sees — the identity guarantee of §1 with zero native OAuth setup.
 */

export type SignInFailure = 'config' | 'cancelled' | 'no-code' | 'server';

export type SignInOutcome =
  | { ok: true; session: SessionResponse }
  | { ok: false; failure: SignInFailure; message: string };

export async function runGoogleSignIn(): Promise<SignInOutcome> {
  if (!isApiConfigured) {
    return {
      ok: false,
      failure: 'config',
      message: 'EXPO_PUBLIC_API_BASE_URL is not set — copy mobile/.env.example to mobile/.env.',
    };
  }

  // Bare app origin: `naijabites://` in a build, `exp://host:port` in Expo Go.
  const redirectUri = Linking.createURL('');
  const startUrl =
    `${API_BASE_URL}/api/mobile/auth/start?redirect_uri=${encodeURIComponent(redirectUri)}`;

  let result: WebBrowser.WebBrowserAuthSessionResult;
  try {
    // The Custom Tab stays open until Google hands back our own scheme —
    // never a WebView, never our page rendering provider content (FR-M1.2).
    result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  } catch {
    return { ok: false, failure: 'cancelled', message: 'Sign-in was interrupted — try again.' };
  }

  if (result.type !== 'success') {
    return { ok: false, failure: 'cancelled', message: 'Sign-in was cancelled.' };
  }

  const code = extractQueryParam(result.url, 'code');
  if (!code) {
    return {
      ok: false,
      failure: 'no-code',
      message: 'Google returned without a sign-in code — please try again.',
    };
  }

  try {
    const session = await api.post<SessionResponse>('/api/mobile/auth/exchange', { code });
    return { ok: true, session };
  } catch (error) {
    return {
      ok: false,
      failure: 'server',
      message:
        error instanceof Error && error.message
          ? error.message
          : 'Could not start your session — please try again.',
    };
  }
}

/**
 * Query param extraction by hand: Hermes's URL parser is not guaranteed to
 * handle custom schemes (`naijabites://?code=…`), and this must work on the
 * one code path the whole sign-in depends on.
 */
function extractQueryParam(url: string, key: string): string | null {
  const match = new RegExp(`[?&]${key}=([^&#]*)`).exec(url);
  if (!match || !match[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}