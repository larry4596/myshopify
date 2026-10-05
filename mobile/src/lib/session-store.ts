import * as SecureStore from 'expo-secure-store';

import type { MobileUser } from './types';

/**
 * Session persistence (PRD-LESSON3 §5, FR-M1.3/FR-M1.4).
 *
 * SecureStore is backed by the Android Keystore / iOS Keychain, so a stolen
 * app-data directory or device backup never yields a usable session token —
 * the one storage rule this app must not break.
 *
 * Two keys instead of one blob: the token is small and write-critical, the
 * profile is only for display. Both are cleared together, always.
 */
const TOKEN_KEY = 'naijabites.session.token.v1';
const USER_KEY = 'naijabites.session.user.v1';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

export interface StoredSession {
  token: string;
  user: MobileUser;
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY, OPTIONS),
      SecureStore.getItemAsync(USER_KEY, OPTIONS),
    ]);
    if (!token || !userJson) return null;

    const user = JSON.parse(userJson) as Partial<MobileUser> | null;
    if (!user || typeof user.id !== 'string') return null;

    return {
      token,
      user: user as MobileUser,
    };
  } catch {
    // Corrupt or unreadable storage is treated as signed-out, never a crash.
    return null;
  }
}

export async function writeSession(session: StoredSession): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEY, session.token, OPTIONS),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user), OPTIONS),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS),
    SecureStore.deleteItemAsync(USER_KEY, OPTIONS),
  ]);
}
