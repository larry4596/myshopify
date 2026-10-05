"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
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
 * - Lesson 3 P3: when a session exists the cart ALSO mirrors to the server
 *   (`PUT /api/cart/items`, debounced 400 ms, fire-and-forget with a 3 s
 *   timeout per PRD-LESSON3 R6). The localStorage path stays exactly as it
 *   is underneath — deleting the mirror restores Lesson 2 unchanged.
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

/** Fire-and-forget mirror PUT (PRD-LESSON3 R6: debounced by the caller, 3 s timeout). */
const MIRROR_DEBOUNCE_MS = 400;

async function mirrorLines(lines: CartLine[]): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch("/api/cart/items", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lines }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // A failed mirror must never break shopping — the localStorage cart is
    // the source of truth on this device; P4 adds retry/queueing.
  }
}

/** Validate server lines: shape + 1..20 integers + dedupe. */
function sanitizeServerLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const lines: CartLine[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const { slug, quantity } = entry as { slug?: unknown; quantity?: unknown };
    if (typeof slug !== "string" || slug.length === 0 || seen.has(slug)) continue;
    if (!Number.isInteger(quantity)) continue;
    seen.add(slug);
    lines.push({ slug, quantity: clampQuantity(quantity as number) });
  }
  return lines;
}

/**
 * Client-side fold of a guest cart into the server cart (PRD-LESSON3 §7.3).
 *
 * Union of lines, per-line quantity is the MAX of both sides. Max (not sum)
 * keeps sign-out/sign-in cycles idempotent: re-hydrating an already-synced
 * cart changes nothing, so quantities can never double. Server order first,
 * new guest slugs appended.
 */
function foldLines(server: CartLine[], guest: CartLine[]): CartLine[] {
  const quantities = new Map<string, number>();
  for (const line of server) quantities.set(line.slug, line.quantity);
  for (const line of guest) {
    quantities.set(line.slug, Math.max(quantities.get(line.slug) ?? 0, line.quantity));
  }
  const order = server.map((line) => line.slug);
  for (const line of guest) if (!order.includes(line.slug)) order.push(line.slug);
  return order.map((slug) => ({ slug, quantity: quantities.get(slug) ?? 1 }));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const [lines, setLines] = useState<CartLine[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  /** True once the sign-in hydration attempt has succeeded. */
  const serverReadyRef = useRef(false);
  /** Hydration writes bump this so the mirror doesn't echo them back. */
  const skipMirrorRef = useRef(0);
  const mirrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Lesson 3 P3 — on sign-in, hydrate from the server once, folding any
  // guest lines in with one PUT (§7.3). A failed fetch stays silent: the
  // localStorage cart keeps working and the next mount retries.
  useEffect(() => {
    if (!hydrated || !signedIn || serverReadyRef.current) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/cart", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { lines?: unknown };
        const serverLines = sanitizeServerLines(data.lines);
        if (cancelled) return;
        const guest = linesRef.current;
        if (guest.length === 0 && serverLines.length === 0) {
          serverReadyRef.current = true;
          return;
        }
        const merged = foldLines(serverLines, guest);
        serverReadyRef.current = true;
        skipMirrorRef.current += 1;
        setLines(merged);
        if (guest.length > 0) await mirrorLines(merged);
      } catch {
        // offline — stay local for this session
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, signedIn]);

  // Signed out again — the next sign-in re-hydrates from scratch.
  useEffect(() => {
    if (status === "unauthenticated") serverReadyRef.current = false;
  }, [status]);

  // Lesson 3 P3 — mirror every change while signed in (debounced 400 ms,
  // fire-and-forget per R6). The localStorage persist above stays the
  // source of truth underneath.
  useEffect(() => {
    if (!hydrated || !signedIn || !serverReadyRef.current) return;
    if (skipMirrorRef.current > 0) {
      skipMirrorRef.current -= 1;
      return;
    }
    if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
    const snapshot = lines;
    mirrorTimerRef.current = setTimeout(() => {
      void mirrorLines(snapshot);
    }, MIRROR_DEBOUNCE_MS);
    return () => {
      if (mirrorTimerRef.current) clearTimeout(mirrorTimerRef.current);
    };
  }, [lines, hydrated, signedIn]);

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