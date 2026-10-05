/**
 * Shapes returned by the Next.js BFF (`/api/mobile/*`).
 *
 * Kept deliberately identical to the store's own types (`lib/products.ts`,
 * `lib/orders.ts`) so neither side needs a translation layer.
 */

export interface Product {
  slug: string;
  name: string;
  description: string;
  priceKobo: number;
  /** Site-relative, e.g. "/products/puff-puff.svg" — pass through resolveImageUrl(). */
  imageUrl: string;
}

export interface CartLine {
  slug: string;
  quantity: number;
}

export interface CartResponse {
  lines: CartLine[];
  updatedAt: string;
}

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/** Response of POST /api/mobile/auth/exchange (PRD-LESSON3 §7.1). */
export interface SessionResponse {
  token: string;
  user: MobileUser;
}
