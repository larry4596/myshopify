# NaijaBites Mobile — Lesson 3 PRD

**Platform:** Expo (managed) + React Native + TypeScript
**Backend:** the *same* Next.js 15 app on `https://myshopify-seven.vercel.app` + the *same* Supabase project
**Auth:** the *same* Google account, the *same* `public.users` rows
**Goal:** an installable Android APK whose cart synchronises both ways with the web store

> Companion to [`PRD.md`](./PRD.md) (Lesson 2 — the web store). This document covers
> only what is *new* in Lesson 3. Where the two disagree about a shared table
> (`users`, `products`, `orders`, `order_items`) **Lesson 2 wins** — nothing there changes.

---

## 1. The problem this lesson actually solves

Lesson 2's cart lives in `localStorage` (`components/CartProvider.tsx`). That is
deliberately good for a browser — a cart that survives a refresh without asking anyone
to log in — but it is **invisible to every other device**. Add a box of puff-puff on
your laptop and your phone knows nothing about it.

Lesson 3 moves the *signed-in* cart into Postgres and leaves the guest cart exactly
where it is. The web app keeps working signed-out; only signed-in state moves to the
database.

### 1.1 The constraint that shapes the entire design

`public.users.id` is **not** a Supabase Auth id and **not** a random UUID. It is a
deterministic **UUIDv5** derived from Google's account identifier:

```ts
// lib/users.ts
const USER_ID_NAMESPACE = "11398d0f-9b90-4320-9c2b-c830f19fe94c";
uuidv5(namespace, `google:${sub}`)   // SHA-1, version 5, RFC 4122 variant
```

Google issues a **different `sub` for every OAuth `client_id`**. Your `lib/users.ts`
comments already call this out at lines 107–116.

> **Consequence:** if the Expo app registers *its own* Google OAuth client, the same
> human being becomes a *different row* in `public.users` on the app than on the web.
> Different row → different cart → **silent, total sync failure.** Nothing would look
> broken; you'd just get two people who never see each other's basket.

So the app must never create its own identity path — it doesn't. Sign-in runs
**inside the website's own Auth.js login**, in a browser tab, so the `sub` that
ever reaches `lib/users.ts` is the web client's (§4). That is requirement #1 of
the implementation, not a detail. §4 describes exactly how.

---

## 2. Goals / non-goals

### Goals

| #  | Goal |
|----|------|
| G1 | Sign in on Android with the same Google account that signs in on the web |
| G2 | Resolve to the **same `public.users.id`** on both platforms |
| G3 | Cart syncs **both directions**: Web → Mobile and Mobile → Web |
| G4 | Cart survives app kill, sign-out, reinstall and device change |
| G5 | Signed-out browsing still works, with a local cart that merges on sign-in |
| G6 | Checkout and order history stay on the **web** — the app is browse, basket, account |
| G7 | A signed, installable **release APK** for submission |
| G8 | Brand-identical UI (deep green / gold / cream) |

### Non-goals — explicitly out of scope

- **iOS / App Store.** Android APK only.
- **Supabase Auth.** Not needed, not introduced. The bridge is Google → our server.
- **Push notifications.** The sync indicator polls (§8.4).
- **Real-time websockets.** Polling every 5 s meets the requirement and cannot fail
  silently. A deliberate simplification, documented rather than hidden.
- **Admin / fulfilment features** on mobile.
- **In-app checkout, Paystack or order history on mobile.** Payment and receipts
  are a web concern in this lesson; the app covers browse → basket → account.
- **Any change to `create_order`, `priceCart`, or Paystack secret handling.**

---
## 3. Architecture

```
┌──────────────────────────┐        ┌─────────────────────────────────┐
│  WEB  (unchanged)        │        │  ANDROID APP (new)              │
│  Next.js 15 on Vercel    │        │  Expo + Expo Router             │
│                          │        │                                 │
│  Auth.js v5 ──┐          │        │  expo-web-browser ─────────┐    │
│               │          │        │  openAuthSessionAsync      │    │
│               ▼          │        │  (Chrome Custom Tab)       │    │
│      session.user.id     │        │            ▼               │    │
│      (UUIDv5 of sub)     │        │  GET  /api/mobile/auth/start    │
│               │          │        │  GET  /api/mobile/auth/finish   │
│               │          │        │  POST /api/mobile/auth/exchange │
│               │          │        │            │               │    │
└───────────────┼──────────┘        └────────────┼───────────────┘    │
                │                                │                     │
                │        ┌───────────────────────▼────────────────────┐│
                │        │  https://myshopify-seven.vercel.app       ││
                │        │  (Backend-for-Frontend — the SAME         ││
                │        │   Next.js app, no second backend)         ││
                │        │                                            ││
                │        │  /api/auth/[...nextauth]  (web)           ││
                │        │  /api/mobile/auth/*       (new, P1)       ││
                │        │  /api/mobile/products     (new, P2)       ││
                │        │  /api/cart  ·  /api/cart/items (shared)   ││
                │        │            │                              ││
                │        │            │ resolveUser(): cookie OR Bearer
                │        │            │ userIdFromGoogleSub(sub)     ││
                │        │            ▼                              ││
                │        │   UUIDv5 ──► ONE public.users.id          ││
                │        └────────────┬─────────────────────────────┘│
                │                     │ service-role key (never leaves the server)
                ▼                     ▼
        ┌───────────────────────────────────────────────────────┐
        │  Supabase Postgres (SAME PROJECT)                     │
        │  users · products · orders · order_items              │
        │  cart_items (NEW, P3) · mobile_auth_codes (NEW, P1)   │
        │  RLS enabled, zero policies                           │
        └───────────────────────────────────────────────────────┘
```

**Why a BFF and not a direct-to-Supabase app?** Three reasons, in order of weight:

1. **Identity.** The app holds no credential of its own: it borrows the
   website's authenticated browser session through server-issued one-time
   codes (§7.1). Trust stays anchored in Auth.js and the site's https origin —
   and there is nothing Google-signed left for the app to verify, because the
   verification already happened inside Auth.js, server-side, as always.
2. **Your existing security model.** `supabase/schema.sql` enables RLS with zero
   policies, and `lib/supabase.ts` is `import "server-only"`. Going direct would mean
   adding policies, exposing the publishable key in the APK, and weakening a decision
   Lesson 2 made deliberately.
3. **One code path for carts and money.** `priceCart`, `create_order` and the cart
   endpoints are shared routes: both platforms literally call the same URLs through
   the same `resolveUser()` (A4), so the app cannot introduce a second pricing path
   to audit.

**What ships inside the APK:** the API base URL and the app's own deep-link
scheme — both public by definition. No Supabase key, no Paystack key, no
`AUTH_SECRET`, no Google client id.

---
## 4. Identity bridge — how one Google account becomes one row

This is the heart of the lesson. Steps 2–5 are exactly what the web already does, just
reached by a different door — the app drives *that* door from a browser tab.

| # | Where | What happens |
|---|-------|--------------|
| 1 | **App** | `expo-web-browser.openAuthSessionAsync` opens `GET /api/mobile/auth/start?redirect_uri=…` in a Chrome Custom Tab. The target must pass the server's allow-list: `naijabites://` (dev build / APK) or Expo Go's `exp://<metro-host>…`. |
| 2 | **Browser → Auth.js** | `start` serves a page that auto-submits the *same* CSRF-protected provider form the website's "Continue with Google" button posts → Google consent → `/api/auth/callback/google` — the **existing** web callback, on the **existing** `GOOGLE_CLIENT_ID`. Auth.js's `signIn` callback runs `upsertUser(...)`, exactly as on the website. |
| 3 | **Server** | Auth.js redirects to `GET /api/mobile/auth/finish?txn=…`. `finish` verifies the signed txn, reads `sub` from the session cookie, derives `userIdFromGoogleSub(sub)` and stores a **60-second, single-use code** in `public.mobile_auth_codes`. |
| 4 | **Browser → App** | `finish` 302s to the allow-listed `redirect_uri?code=…`. The OS closes the Custom Tab and hands the URL back to the app. |
| 5 | **App → Server** | `POST /api/mobile/auth/exchange { code }` consumes the code with one atomic `DELETE … RETURNING` (exactly once, ever) and mints a **30-day** token with Auth.js's own `encode()` — same `AUTH_SECRET`, same encrypted-JWT shape as the website's session cookie. |

No `id_token` verification, no JWKS fetch, no second OAuth client, no Expo
proxy — and **no Google Cloud Console change at all**, because Google only ever
redirects to this site's registered https callback, which is precisely where the
app's flow enters anyway.

### 4.1 Why the app stores a token instead of a cookie

Auth.js hands the browser an httpOnly session cookie. A React Native app has no cookie
jar and no origin, so the cookie cannot travel. Instead the server mints the token with
**Auth.js's own `encode()`** (already in the dependency tree via `next-auth` — zero new
server dependencies):

```
format:   Auth.js JWE (A256CBC-HS512), key derived from AUTH_SECRET
claims:   { sub: <google sub>, name, email, picture }   ← the cookie's own claims
salt:     "__Secure-next-auth.session-token"            ← Auth.js's cookie-name salt
expiry:   30 days (Auth.js's default session length)
```

Because the token is byte-for-byte the same credential *kind* as the website's
cookie, one helper can accept both — see §4.2. The same `AUTH_SECRET` signs
web sessions and mobile sessions: one secret to rotate, not two.

The app keeps this token in **`expo-secure-store`** (Android Keystore-backed, not
plaintext `AsyncStorage`) and sends it as `Authorization: Bearer <token>`.

### 4.2 One resolver for both platforms — `lib/resolve-user.ts` (A4)

Every shared route calls the same function:

```ts
export async function resolveUser(req: Request): Promise<ResolvedUser | null>
```

It wraps Auth.js's own `getToken()`, which reads **the session cookie *or* the
`Authorization: Bearer` header**, trying both cookie-name salts (secure and
plain hosts), so a localhost session and a Vercel session and the app's token all
resolve identically:

1. Is a credential present (cookie or Bearer)?
2. Does it decrypt against `AUTH_SECRET` and still have life in it?
3. `sub` present → `id = userIdFromGoogleSub(sub)` — the same derivation the
   session callback uses, so web and app can never disagree about who this is.

Web behaviour is unchanged (a cookie request resolves exactly like `auth()`); the
app's Bearer token resolves to the identical `users.id`. Any "no" → `401 { message }`.
Nothing in the app trusts local state about identity.

### 4.3 Google Cloud Console — nothing to do

**No new OAuth client. No new redirect URI. No Android OAuth client, no SHA-1
fingerprints, no `auth.expo.io` proxy URL.** The app never speaks OAuth to Google:
every leg runs inside the site's own https origin, and Google's registered callbacks
(localhost + production, from Lesson 2) are already the right ones. The
`GOOGLE_CLIENT_ID` that exists stays exactly where it is — server-side, inside
Auth.js — and never appears in the app or its APK.

---
## 5. Technology decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | **Expo, managed workflow** | Mandated; no native modules to hand-configure |
| Language | **TypeScript**, `strict` | Matches Lesson 2 |
| Navigation | **Expo Router** (file-based) | Same mental model as the App Router; deep links come free |
| Server state | **React Query** (`@tanstack/react-query`) | Caching, retries and background refetch — exactly the primitives sync needs |
| Local cart (guest) | **`@react-native-async-storage/async-storage`** | The mobile analogue of `localStorage` |
| Token storage | **`expo-secure-store`** | Android Keystore-backed; a stolen app-data dir must not yield a session |
| Images | **`expo-image`**, `react-native-svg` for SVG | Catalog images are `.svg` (`/products/*.svg`) — see §10 R3 |
| Sign-in browser | **`expo-web-browser`** (`openAuthSessionAsync`) | Real Chrome Custom Tab running the web's own Auth.js flow — no WebView, no credentials in-app |
| Styling | **`StyleSheet` + one `theme.ts`** | No NativeWind Metro transformer, which is a common first-build failure on EAS. Tokens live in one file mirroring `globals.css`. |
| URL scheme | `naijabites://` (builds) · `exp://` (Expo Go) | The allow-listed sign-in return target (§7.1) — both enforced server-side, neither needs Google's attention |
| APK build | **EAS Build (cloud)** | Android Gradle signing handled for you; no local Android SDK needed |

### 5.1 Deliberate non-choices

- **No Redux / Zustand.** React Context + React Query cover this app; a store would add
  a second source of truth next to the server.
- **No NativeWind.** Pleasant, but the Metro transformer is a frequent cause of EAS
  first-build failures. A `theme.ts` is ~60 lines and cannot break a build.
- **No Supabase JS client in the app.** Decided in §3.
- **No native Google SDK, no `id_token` verification, no `expo-auth-session`.** The
  browser flow (§4) makes all three unnecessary — and with them goes every Android
  OAuth client, SHA-1 fingerprint and redirect-URI registration from the setup.

---

## 6. Data model — two new tables

`users`, `products`, `orders` and `order_items` are **untouched**. Two idempotent
migrations, both safe to paste into a database that already has Lesson 2's schema:

- [`supabase/mobile-auth.sql`](./supabase/mobile-auth.sql) (**P1**) — `mobile_auth_codes`
- [`supabase/cart-schema.sql`](./supabase/cart-schema.sql) (**P3**) — `cart_items` + `merge_cart`

```sql
create table if not exists public.cart_items (
  user_id    uuid    not null references public.users (id)    on delete cascade,
  product_id uuid    not null references public.products (id) on delete cascade,
  quantity   integer not null check (quantity > 0 and quantity <= 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.cart_items enable row level security;  -- zero policies, as everywhere
```

Plus one function, `merge_cart(p_user_id uuid, p_items jsonb)`, which folds a guest
cart into a signed-in one atomically (§8.3).

### 6.1 Sign-in codes (P1) — `public.mobile_auth_codes`

```sql
create table if not exists public.mobile_auth_codes (
  code       text        primary key,   -- 256-bit random hex, TTL 60 seconds
  user_id    uuid        not null references public.users (id) on delete cascade,
  sub        text        not null,      -- Google account id
  name       text,  email text,  image text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.mobile_auth_codes enable row level security;  -- zero policies
```

| Decision | Why |
|----------|-----|
| Single-use enforced by `DELETE … RETURNING` | One atomic statement is check *and* consumption — a replayed code finds no row and gets no token (§7.1). |
| 60-second TTL + opportunistic purge | Codes die young; the table stays ~empty with no scheduled job. |
| Profile claims copied into the row | The exchange is one delete plus one `encode()` — no user lookup, no window where the code exists but the profile doesn't. |
| RLS enabled, zero policies | Same stance as every table here: anon/authenticated can read nothing; only the server's service role touches these rows. |

### 6.2 Design notes — `cart_items`

| Decision | Why |
|----------|-----|
| Keyed on `product_id`, not `slug` | `ON DELETE CASCADE` cleans up when a product is delisted. `products.slug` is UNIQUE, so the API can still speak slugs and `priceCart`/`create_order` need **no changes at all**. |
| **No price column** | Matches the existing security stance: the client never holds a price. A cart synced through a database is a *bigger* attack surface, not a smaller one. |
| `check (quantity between 1 and 20)` | Exactly the window `create_order` enforces, so a synced cart can never be rejected at checkout. |
| No surrogate `id` column | `(user_id, product_id)` is the natural key. Fewer moving parts. |
| No extra index | The primary key's leftmost prefix already covers every `where user_id = ?` this app makes. |
| `updated_at` | Diagnostic only. Change detection compares fetched lines, never clocks (§8.4). |

### 6.3 Types

`lib/database.types.ts` gains `mobile_auth_codes` and `cart_items` entries (and a
`merge_cart` signature), so every query is compile-time checked — the same discipline
as Lesson 2.

---
## 7. API contract

All new routes live in the existing Next.js app — no second backend. Anything
authenticated goes through **`resolveUser()`** (§4.2, A4): the Auth.js session
cookie for web requests, `Authorization: Bearer <token>` for the app. One helper,
one `users.id`, and **the cart routes below are called by both platforms —
byte-identical URLs, not a parallel `/api/mobile/*` dialect**.

### 7.1 Mobile sign-in — three endpoints

**`GET /api/mobile/auth/start?redirect_uri=<uri>`** — validates `uri` against the
allow-list (`naijabites://` for a build, `exp://…` for Expo Go), signs it
into a `txn`, and returns a tiny page that auto-submits Auth.js's CSRF-protected
provider form with the `finish` URL as its same-origin `callbackUrl`. Opened by
`openAuthSessionAsync`; a bad `redirect_uri` gets `400 { message }` before any
browser leaves the app.

**`GET /api/mobile/auth/finish?txn=<signed>`** — runs inside the browser, still
carrying the Auth.js session cookie. Verifies the txn, reads `sub` from the cookie,
inserts a code into `public.mobile_auth_codes` (TTL **60 s**, single-use), then 302s
to `redirect_uri?code=…`. No session or bad txn → a human-readable `400` page —
never a redirect anywhere.

**`POST /api/mobile/auth/exchange { code }`**

```jsonc
// request — body capped at 8 KB
{ "code": "<64 hex chars>" }

// 200
{
  "token": "<Auth.js JWE, 30-day expiry>",
  "user": { "id": "<uuid>", "email": "...", "name": "...", "image": "..." }
}
// 401 { "message": "That sign-in code is invalid, expired or already used — try again." }
// 429 { "message": "Too many attempts — wait a minute and sign in again." }
```

The code is consumed with one atomic `DELETE … RETURNING` — a replay gets no row and
no token. A best-effort per-IP throttle runs in memory (documented honestly as
per-instance; the code's 60-second single-use life is the real brake).

### 7.2 `GET /api/cart` — read the cart (shared, A4)

Identical route, identical response for the website and the app; `resolveUser()`
decides who is asking. Signed-out callers get `401`.

```jsonc
// 200
{
  "lines": [ { "slug": "classic-puff-puff",   "quantity": 2 },
             { "slug": "suya-chicken-wings", "quantity": 1 } ],
  "updatedAt": "2026-10-05T12:00:00.000Z"
}
```

Lines come back **ordered by `cart_items.updated_at DESC`**, so both platforms render
the cart in the same stable order (whichever device added an item first shows it first).

### 7.3 Cart mutations (shared, A4)

| Route | Body | Behaviour |
|-------|------|-----------|
| `PUT /api/cart/items` | `{ lines: [{ slug, quantity }, …] }` | Replaces the caller's cart wholesale. **The single write path for both platforms** — add, stepper tap, remove and clear all send the resulting line list, so there is exactly one mutation to audit. Validates with the rules `priceCart` already enforces: slugs exist, `is_active`, integer quantity in `1..20`, no duplicates. |
| `DELETE /api/cart` | — | Empties the caller's cart ("clear basket"). |

The web's `CartProvider` mirror and the app both speak these two routes through
`resolveUser()` — A4's requirement that web and mobile call the **same** endpoints,
with no forked dialect. The guest-cart merge at sign-in is a client-side fold
(local lines ∪ server lines) written back with one `PUT`; the `merge_cart(...)`
RPC from `cart-schema.sql` may be used *inside* the route for atomicity, but it is
an implementation detail — the table above is the whole contract clients see.

### 7.4 `GET /api/mobile/products` — the catalogue

Unauthenticated. `Cache-Control: public, max-age=60, s-maxage=600`. Returns
`{ products: Product[] }` from `public.products where is_active`.

Product `image_url` values are site-**relative** (`/products/puff-puff.svg`), so the app
joins them onto the base URL in one helper and the path never appears scattered
through components.

### 7.5 Orders & Paystack — not applicable

There are **no mobile order or payment endpoints**. Checkout, Paystack and order
history remain web-only concerns (§2 non-goals); the app's write surface is the cart
routes above and nothing else.

---
## 8. Feature requirements

### 8.1 Authentication

| # | Requirement |
|---|------------|
| FR-M1.1 | The app offers one sign-in method: **Continue with Google**. No email/password form. |
| FR-M1.2 | Sign-in runs in a Chrome Custom Tab, never a WebView. |
| FR-M1.3 | On success the app stores the session token in SecureStore and shows the account screen. |
| FR-M1.4 | The token is restored on cold start, so the app opens already signed in. |
| FR-M1.5 | A `401` from any request clears the token and routes to the sign-in screen — never an infinite loading spinner. |
| FR-M1.6 | Sign-out deletes the token and shows the signed-out UI with a **local** cart. |
| FR-M1.7 | The return leg only ever accepts the allow-listed app schemes (`naijabites://`, Expo Go's `exp://`), and the sign-in code lives 60 seconds and works exactly once. |

### 8.2 Catalogue

| # | Requirement |
|---|------------|
| FR-M2.1 | Home lists every active product: image, name, price, "Add to cart". |
| FR-M2.2 | Product detail shows the full description and a quantity stepper (1–20). |
| FR-M2.3 | Prices always come from the server response, formatted `₦2,500` — kobo divided by 100. |
| FR-M2.4 | Signed-out users can browse and add to a local cart. Nothing on the app is gated behind sign-in — it only changes where the basket lives. |

### 8.3 Cart

| # | Requirement |
|---|------------|
| FR-M3.1 | Signed in → the cart **is** the database row set for that `users.id`. |
| FR-M3.2 | Signed out → the cart is local (AsyncStorage), exactly like `localStorage` on the web. |
| FR-M3.3 | On sign-in with a non-empty local cart, the app folds it into the server cart and writes the union back with `PUT /api/cart/items`; the local copy is then cleared. **Nothing is ever silently discarded.** |
| FR-M3.4 | The header badge shows the total unit count from whichever source is active. |
| FR-M3.5 | Tapping "+" writes optimistically, then PUTs the resulting line list, rolling back and showing a toast on failure. |
| FR-M3.6 | Quantity is clamped to 1–20 client-side (mirroring `MAX_CART_QUANTITY`) *and* by the DB constraint. |

### 8.4 Synchronisation

| # | Requirement |
|---|------------|
| FR-M4.1 | **Mobile → Web:** a cart change on the phone writes to `cart_items`; the web tab's next poll (≤5 s) shows it. |
| FR-M4.2 | **Web → Mobile:** a cart change on the web writes to `cart_items`; the phone's next poll (≤5 s) shows it. |
| FR-M4.3 | Polling runs **only while the Cart screen is focused**, plus once on every app foreground. Nothing polls in the background. |
| FR-M4.4 | A poll that returns a cart different from the cached one updates the UI **silently** — no spinner, no toast, no scroll jump. |
| FR-M4.5 | A **sync indicator** in the Cart header shows one of: `Syncing…` / `Synced · <relative time>` / `Offline — changes will sync when you reconnect`. |
| FR-M4.6 | When the device is offline, changes queue locally and flush on reconnect. The indicator says so. |
| FR-M4.7 | Change detection compares the fetched `{slug, quantity}` list. It never trusts `updated_at` across devices, because device clocks differ. |

**Why polling, honestly:** a websocket would be "more real-time" but adds a Supabase
Realtime channel that, with your RLS-zero setup, cannot be subscribed to from the app
anyway — it would need another server-side publish path. Polling satisfies the
requirement, has no configuration to get wrong, and its worst failure mode (5 s of lag)
is visible and harmless.

---
### 8.5 Account

Checkout and order history are web-only in this lesson (§2 non-goals) — there are no
mobile checkout, receipt or order screens, and no phase builds any.

| # | Requirement |
|---|---------------|
| FR-M5.1 | The account screen shows the Google name, email and avatar, plus Sign out. |

### 8.6 Screen map (Expo Router)

```
src/app/
├── _layout.tsx              root: providers, fonts, splash
├── (tabs)/
│   ├── _layout.tsx          tab bar: Home · Cart · Account
│   ├── index.tsx            Home — product list
│   ├── cart.tsx             Cart — sync indicator, steppers, totals
│   └── account.tsx          Profile / sign out / sync status
├── product/[slug].tsx       Product detail + quantity stepper
└── sign-in.tsx              Branded Google sign-in (browser flow entry)
```

Non-route logic lives beside it in `src/lib/`: `auth-flow.ts` (the Custom Tab
dance, `auth-flow.runGoogleSignIn`), `session-store.ts` (SecureStore persistence)
and `auth-context.tsx` (the one place that knows whether someone is signed in).

---

## 9. Brand & UI

Tokens are copied from `app/globals.css` into `mobile/src/theme.ts` — one file, one
source of truth on the client.

| Token | Value | Usage |
|-------|-------|-------|
| `brand` | `#0F6B3C` | Headers, primary buttons, price accents |
| `brandDark` | `#0B5230` | Pressed states |
| `brandLight` | `#EAF3EE` | Tinted cards, banners |
| `gold` | `#E8B923` | Badges, highlights, accents |
| `goldDark` | `#C99B12` | Pressed gold |
| `cream` | `#F9F5EB` | Screen background |
| `ink` | `#1A1A1A` | Body text |

UI rules: cream background, white cards with a soft shadow, 16px corner radius, pill
buttons, gold used **sparingly** (badges and prices) so the green stays dominant —
matching the web. System font stack, no custom font download. Dark mode is out of scope.

---
## 10. Phases

Each phase ends with a **demonstrable, testable state**. Work stops at the end of each
one for confirmation before the next begins.

| Phase | Deliverable | Done when |
|-------|-------------|-----------|
| **P0** Foundation | `mobile/` Expo + TypeScript + Expo Router, brand theme, navigation shell, API client, SecureStore auth context | App builds and runs in Expo Go with a branded tab bar and an empty-but-correct screen set |
| **P1** Auth | `GET /api/mobile/auth/start` · `GET /api/mobile/auth/finish` · `POST /api/mobile/auth/exchange`; `lib/mobile-auth.ts`; `lib/resolve-user.ts`; `supabase/mobile-auth.sql`; the real browser sign-in screen | Signing in on the phone resolves to the **same `users.id`** as the web (verifiable in the Supabase Table Editor) |
| **P2** Products | `GET /api/mobile/products`; Home + Product detail screens | All 6 seeded products render on the device with correct ₦ prices and images |
| **P3** Cart + shared endpoints + web mirroring | `supabase/cart-schema.sql`; shared `GET /api/cart`, `PUT /api/cart/items`, `DELETE /api/cart` behind `resolveUser()`; web `CartProvider` gains the mirror | Add on phone → appears on web. Add on web → appears on phone. **The core requirement.** |
| **P4** Two-way sync + polling | 5 s polling, sync indicator, offline queue, guest-cart merge | Both directions inside 5 s; indicator accurate; offline/reconnect verified |
| **P5** EAS build + README + DEMO.md | `eas.json`, app icons/splash, `mobile/README.md`, root `README.md` update, `DEMO.md` walkthrough | A signed release APK installs on a physical Android phone and passes the end-to-end checklist |

### 10.1 Work that stops at a phase boundary (deliberate)

P3 changes the **web** `CartProvider` for the first time. That is the highest-risk edit
in the whole lesson, so it gets its own phase with its own sign-off, and it is additive:
the `localStorage` path stays exactly as it is and only gains a mirror when a session
exists. If sync had to be abandoned, deleting the mirror restores Lesson 2 unchanged.

---

## 11. Risks and mitigations

| # | Risk | Mitigation |
|---|------|------------|
| R1 | **The app silently becomes a different user** (new OAuth client → different `sub` → different UUID) | P1's acceptance test *is* this check. Verified in the Supabase Table Editor before any further work. |
| R2 | Expo Go and a real build return through different schemes | Both are on the server allow-list (§7.1): `exp://` for Expo Go, `naijabites://` for builds. Neither involves Google — the redirect chain only ever leaves the site's own https origin. |
| R3 | Catalogue images are `.svg`; some Android image pipelines won't render them | `react-native-svg` handles remote SVG. Verified in P2 — if any image still fails, convert that one file to PNG and update `seed.sql`. |
| R4 | Web and mobile both editing the cart at once | Last write wins **per line**, which is the correct granularity. Tapping "+" twice is additive, not destructive. |
| R5 | EAS free-tier build quota | EAS gives a monthly allowance of cloud builds. We need roughly 2–4 builds; if quota is a problem, `eas build --profile preview --platform android --local` builds on your machine with no quota at all. |
| R6 | Cart sync makes the web slower | The web mirror is debounced (400 ms) and fire-and-forget with a 3 s timeout. Browsing stays signed-out and untouched. |
| R7 | Clock skew across devices | Never used for change detection — see FR-M4.7. `updated_at` is diagnostic only. |

---

## 12. What you do by hand

Everything in this list is a one-time manual step in a dashboard. I cannot do these
for you.

### Supabase
1. Open **SQL Editor → New query**.
2. Paste [`supabase/mobile-auth.sql`](./supabase/mobile-auth.sql) (**P1 — required
   before sign-in can be tested**) and **Run**. No output means success.
3. Later, for P3: paste [`supabase/cart-schema.sql`](./supabase/cart-schema.sql) and
   **Run**. *(Optional)* run the self-check at its bottom, then
   `delete from public.cart_items;`.

### Google Cloud Console
4. **Nothing to do.** No new OAuth client, no new redirect URI, no SHA-1 — the
   browser flow reuses Lesson 2's registered callbacks verbatim (§4.3).

### Expo
5. Account exists: username **larry4596** (used by `eas login` in P5).
6. Install **Expo Go** on your Android phone from the Play Store.
7. When we reach P5: `eas login`, then `eas build -p android --profile production`.

### Vercel
8. Nothing new — the app calls the existing deployment. A **redeploy** once this
   branch merges puts the P1 auth routes live (and again after P3/P4).

---

## 13. Definition of done

- [ ] Signing in on Android creates **no new row** in `public.users` for an account
      that already exists on the web.
- [ ] Add an item on the web → it is on the phone within 5 s.
- [ ] Add an item on the phone → it is on the web within 5 s.
- [ ] The cart survives force-quitting the app.
- [ ] Sign-in from the app needed **no** Google Cloud Console change — no new client,
      no new redirect URI, no SHA-1.
- [ ] `public.mobile_auth_codes` never holds more than a minute's worth of rows.
- [ ] A signed release APK installs and runs on a physical Android phone.
- [ ] No Supabase or Paystack secret appears anywhere in the APK.
- [ ] `README.md` explains setup, sync and the APK build from a clean clone.