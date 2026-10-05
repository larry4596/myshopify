import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { ApiError, api } from './api';
import { useAuth } from './auth-context';
import { clearGuestCart, loadGuestCart, saveGuestCart } from './guest-cart';
import type { CartResponse } from './types';

/**
 * Basket, P3 (PRD-LESSON3 §§7.2, 7.3, FR-M3.x).
 *
 * Signed out → AsyncStorage, like the web's localStorage (FR-M3.2).
 * Signed in → the database row set, through the SAME shared routes the web
 * uses (`GET /api/cart`, `PUT /api/cart/items`), so either device is just a
 * client of one cart (FR-M3.1). On sign-in the guest cart folds into the
 * server cart with one PUT (§7.3) and the local copy is cleared (FR-M3.3).
 */

export interface LocalCartLine {
  slug: string;
  quantity: number;
}

interface CartContextValue {
  lines: LocalCartLine[];
  itemCount: number;
  hydrated: boolean;
  signedIn: boolean;
  addItem: (slug: string, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const MAX_CART_QUANTITY = 20;
const MIRROR_DEBOUNCE_MS = 400;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.floor(quantity)));
}

/** Validate server lines: shape + dedupe + clamp (never trust the wire). */
function sanitizeServerLines(value: unknown): LocalCartLine[] {
  if (!Array.isArray(value)) return [];
  const lines: LocalCartLine[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { slug, quantity } = entry as { slug?: unknown; quantity?: unknown };
    if (typeof slug !== 'string' || slug.length === 0 || seen.has(slug)) continue;
    if (typeof quantity !== 'number') continue;
    seen.add(slug);
    lines.push({ slug, quantity: clampQuantity(quantity) });
  }
  return lines;
}

/**
 * Client-side fold (§7.3): union of lines, per-line MAX. Max keeps
 * sign-out/sign-in cycles idempotent so quantities can never double.
 */
function foldLines(server: LocalCartLine[], guest: LocalCartLine[]): LocalCartLine[] {
  const quantities = new Map<string, number>();
  for (const line of server) quantities.set(line.slug, line.quantity);
  for (const line of guest) {
    quantities.set(line.slug, Math.max(quantities.get(line.slug) ?? 0, line.quantity));
  }
  const order = server.map((line) => line.slug);
  for (const line of guest) if (!order.includes(line.slug)) order.push(line.slug);
  return order.map((slug) => ({ slug, quantity: quantities.get(slug) ?? 1 }));
}

export function CartProvider({ children }: PropsWithChildren) {
  const { status } = useAuth();
  const signedIn = status === 'signedIn';
  const [lines, setLines] = useState<LocalCartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const serverReadyRef = useRef(false);
  const skipMirrorRef = useRef(0);
  const mirrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load the guest cart once (signed-out basket + merge source).
  useEffect(() => {
    let cancelled = false;
    void loadGuestCart().then((stored) => {
      if (!cancelled) {
        setLines(stored);
        setHydrated(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Signed out → keep persisting the guest cart.
  useEffect(() => {
    if (!hydrated || signedIn) return;
    void saveGuestCart(lines);
  }, [lines, hydrated, signedIn]);

  // On sign-in: pull the server cart, fold the guest cart in with one
  // PUT, clear the local copy (FR-M3.3). Failures stay silent — the guest
  // cart keeps working and the next mount retries.
  useEffect(() => {
    if (!hydrated || !signedIn || serverReadyRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<CartResponse>('/api/cart');
        if (cancelled) return;
        const serverLines = sanitizeServerLines(data.lines);
        const guest = linesRef.current;
        if (guest.length === 0 && serverLines.length === 0) {
          serverReadyRef.current = true;
          return;
        }
        const merged = foldLines(serverLines, guest);
        serverReadyRef.current = true;
        skipMirrorRef.current += 1;
        setLines(merged);
        if (guest.length > 0) {
          await api.put('/api/cart/items', { lines: merged });
          await clearGuestCart();
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, signedIn]);

  // Signed out again → back to the guest cart, fresh hydration next time.
  useEffect(() => {
    if (status !== 'signedOut') return;
    serverReadyRef.current = false;
    let cancelled = false;
    void loadGuestCart().then((stored) => {
      if (!cancelled) {
        skipMirrorRef.current += 1;
        setLines(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [status]);

  // Mirror every change while signed in (debounced, fire-and-forget, R6).
  useEffect(() => {
    if (!hydrated || !signedIn || !serverReadyRef.current) return;
    if (skipMirrorRef.current > 0) {
      skipMirrorRef.current -= 1;
      return;
    }
    if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
    const snapshot = lines;
    mirrorTimerRef.current = setTimeout(() => {
      void api.put('/api/cart/items', { lines: snapshot }).catch(() => undefined);
    }, MIRROR_DEBOUNCE_MS);
    return () => {
      if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
    };
  }, [lines, hydrated, signedIn]);

  const addItem = useCallback((slug: string, quantity = 1) => {
    const amount = clampQuantity(quantity);
    setLines((prev) => {
      const existing = prev.find((line) => line.slug === slug);
      if (!existing) return [...prev, { slug, quantity: amount }];
      return prev.map((line) =>
        line.slug === slug
          ? { ...line, quantity: clampQuantity(line.quantity + amount) }
          : line,
      );
    });
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    const amount = clampQuantity(quantity);
    setLines((prev) =>
      prev.map((line) => (line.slug === slug ? { ...line, quantity: amount } : line)),
    );
  }, []);

  const removeItem = useCallback((slug: string) => {
    setLines((prev) => prev.filter((line) => line.slug !== slug));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
  }, []);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = lines.reduce((total, line) => total + line.quantity, 0);
    return { lines, itemCount, hydrated, signedIn, addItem, setQuantity, removeItem, clearCart };
  }, [lines, hydrated, signedIn, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Read + mutate the guest basket from any screen. */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>.');
  return context;
}
