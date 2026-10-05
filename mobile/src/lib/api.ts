import { API_BASE_URL, isApiConfigured } from './config';

/**
 * The app's single HTTP entry point.
 *
 * Everything the app fetches goes through here so that four concerns live in
 * exactly one place (PRD-LESSON3 §5):
 *   1. the base URL of the Next.js BFF,
 *   2. the bearer token, which follows the session automatically,
 *   3. a hard timeout, so a dead network shows an error instead of a spinner,
 *   4. 401 handling — clear the session and let the UI react (FR-M1.5).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

/** Registered by <AuthProvider> so the bearer token follows the session. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Registered by <AuthProvider>; fired on any 401 (FR-M1.5). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Defaults to 10 s — long enough for a cold serverless start. */
  timeoutMs?: number;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiError(
      'EXPO_PUBLIC_API_BASE_URL is not set — copy .env.example to mobile/.env and fill it in.',
      0,
    );
  }

  const { method = 'GET', body, timeoutMs = 10_000 } = options;
  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        accept: 'application/json',
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      aborted ? 'That took too long — check your connection and try again.' : 'Could not reach NaijaBites. Check your connection.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const payload: unknown = text ? safeParseJson(text) : null;

  if (!res.ok) {
    // FR-M1.5: a 401 anywhere drops the session — never an infinite spinner.
    if (res.status === 401) {
      authToken = null;
      unauthorizedHandler?.();
    }
    throw new ApiError(extractMessage(payload) ?? `Request failed (${res.status}).`, res.status);
  }

  return payload as T;
}

export const api = {
  get: <T,>(path: string) => apiRequest<T>(path),
  post: <T,>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T,>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T,>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  del: <T,>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body }),
};

/**
 * Product images are stored site-relative (`/products/puff-puff.svg`) so the
 * same seed works on localhost and Vercel. The app joins them onto the BFF
 * origin here — the path never appears scattered through components
 * (PRD-LESSON3 §7.4).
 */
export function resolveImageUrl(imageUrl: string): string {
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (!isApiConfigured) return imageUrl;
  return `${API_BASE_URL}${imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`}`;
}

/** Kobo → "₦2,500", exactly like the store's lib/products.ts formatNaira. */
const NGN_FORMATTER_OPTIONS: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
};

let nairaFormatter: Intl.NumberFormat | null = null;

export function formatNaira(priceKobo: number): string {
  const naira = priceKobo / 100;
  try {
    // Hermes ships Intl, but keep a fallback: a formatting bug must never
    // break the catalogue screen.
    nairaFormatter ??= new Intl.NumberFormat('en-NG', NGN_FORMATTER_OPTIONS);
    return nairaFormatter.format(naira);
  } catch {
    const rounded = Math.round(naira);
    return `₦${String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function extractMessage(payload: unknown): string | null {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return null;
}
