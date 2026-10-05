import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LocalCartLine } from './cart-context';

/**
 * AsyncStorage persistence for the guest basket — the mobile analogue of the
 * web's localStorage cart (PRD-LESSON3 FR-M3.2). One key, one shape
 * (`{slug, quantity}[]`), corrupted data self-heals to empty.
 */

const GUEST_CART_KEY = 'naijabites:guest-cart:v1';

function isValidLine(value: unknown): value is LocalCartLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as { slug?: unknown; quantity?: unknown };
  return (
    typeof line.slug === 'string' &&
    line.slug.length > 0 &&
    typeof line.quantity === 'number' &&
    Number.isFinite(line.quantity) &&
    line.quantity >= 1
  );
}

export async function loadGuestCart(): Promise<LocalCartLine[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidLine);
  } catch {
    return [];
  }
}

export async function saveGuestCart(lines: LocalCartLine[]): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_CART_KEY, JSON.stringify(lines));
  } catch {
    // A full disk must never break adding to the basket; the in-memory
    // copy keeps working for this session.
  }
}

export async function clearGuestCart(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Best-effort — sign-in merge (P4) retries from the context value.
  }
}
