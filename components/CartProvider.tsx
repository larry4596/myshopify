"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getProductBySlug } from "@/lib/products";

/**
 * Cart state — Phase 4 (PRD FR4.1 / FR4.2).
 *
 * Design notes:
 * - A line is ONLY `{ slug, quantity }`. Prices are never stored: they come
 *   from the catalog at render time, and the server re-prices every line from
 *   the database before charging (FR4.7). A cart left in localStorage for days
 *   can therefore never carry a stale price into a payment.
 * - Persisted in localStorage so it survives refreshes and works signed-out
 *   (FR4.2). Nothing about ORDERS lives here — those are server-side only
 *   (FR3.3).
 * - localStorage is read inside an effect, never during render, so the server
 *   HTML and the first client render always agree (no hydration mismatch).
 */

/** Mirrors the server-side limit enforced by `create_order` (1..20). */
export const MAX_CART_QUANTITY = 20;

const STORAGE_KEY = "naijabites:cart:v1";

export type CartLine = { slug: string; quantity: number };

type CartContextValue = {
  /** Cart lines in insertion order. Always empty until `hydrated` is true. */
  lines: CartLine[];
  /** Total units across every line — drives the header badge (FR4.1). */
  itemCount: number;
  /** False on the server / first client render; true once storage is read. */
  hydrated: boolean;
  addItem: (slug: string, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.trunc(quantity)));
}

/**
 * Parse + validate whatever is in localStorage. Malformed rows and slugs that
 * no longer exist in the catalog are dropped rather than trusted.
 */
function readStoredCart(): CartLine[] {
  if (typeof window === "undefined") return [];

  let parsed: unknown;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    parsed = JSON.parse(raw);
  } catch {
    return []; // corrupt JSON — start over instead of breaking the shop
  }
  if (!Array.isArray(parsed)) return [];

  const lines: CartLine[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) continue;
    const { slug, quantity } = entry as { slug?: unknown; quantity?: unknown };
    if (typeof slug !== "string" || !getProductBySlug(slug)) continue;
    if (typeof quantity !== "number") continue;
    lines.push({ slug, quantity: clampQuantity(quantity) });
  }
  return lines;
}

function writeStoredCart(lines: CartLine[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode or quota exceeded — the cart still works for this page view.
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount (client only).
  useEffect(() => {
    setLines(readStoredCart());
    setHydrated(true);
  }, []);

  // Persist on every change — but never before the first read, or an empty
  // cart would wipe what the visitor had stored.
  useEffect(() => {
    if (!hydrated) return;
    writeStoredCart(lines);
  }, [lines, hydrated]);

  // Keep two open tabs in sync (harmless where `storage` is unsupported).
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setLines(readStoredCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addItem = useCallback((slug: string, quantity = 1) => {
    if (!getProductBySlug(slug)) return;
    setLines((current) => {
      const existing = current.find((line) => line.slug === slug);
      if (!existing) {
        return [...current, { slug, quantity: clampQuantity(quantity) }];
      }
      return current.map((line) =>
        line.slug === slug
          ? { ...line, quantity: clampQuantity(line.quantity + quantity) }
          : line,
      );
    });
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setLines((current) =>
      current.map((line) =>
        line.slug === slug
          ? { ...line, quantity: clampQuantity(quantity) }
          : line,
      ),
    );
  }, []);

  const removeItem = useCallback((slug: string) => {
    setLines((current) => current.filter((line) => line.slug !== slug));
  }, []);

  const clearCart = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      itemCount: lines.reduce((total, line) => total + line.quantity, 0),
      hydrated,
      addItem,
      setQuantity,
      removeItem,
      clearCart,
    }),
    [lines, hydrated, addItem, setQuantity, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Read + mutate the cart from any client component. */
export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error(
      "useCart must be used inside <CartProvider> (see app/layout.tsx)",
    );
  }
  return context;
}