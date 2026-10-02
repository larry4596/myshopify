# PRD — NaijaBites E-Commerce Store

**Version:** 1.0
**Date:** 2026-02-10
**Author:** Built for HNG 15 — Lesson 2
**Status:** Approved for Phase 1

---

## 1. Overview

**NaijaBites** is a functional e-commerce web store for homemade Nigerian snacks and
small chops (puff-puff, chin-chin, meat pies, spring rolls, suya wings, assorted
boxes), delivered fresh in Lagos.

- **Tagline:** *Fresh. Homemade. Delivered.*
- **Audience:** Busy professionals, students, and families in Lagos who want
  authentic homemade snacks without cooking.
- **Currency:** Nigerian Naira (₦ / NGN)

This is **not a static site**. The core of the project is real integrations:
Google sign-in, a persistent cloud database, durable order history, real payment
test-mode checkout, and a real confirmation email sent through Mailgun.

## 2. Goals & Success Criteria

The project is "done" when every item in this table passes:

| # | Scenario (how it will be tested) | Pass criteria |
|---|----------------------------------|---------------|
| G1 | Sign in | User signs in with their Google account and sees their name/avatar in the header |
| G2 | Orders visible after login | After signing in, the user's previous orders appear on their orders page |
| G3 | Logout | Signing out clears the session UI; protected pages require sign-in again |
| G4 | Session durability | Close the browser entirely, reopen, sign in again → previous orders still visible (orders live in Supabase, not in the browser) |
| G5 | Confirmation email | Completing checkout sends a real, well-formatted HTML email to the buyer's inbox via Mailgun |
| G6 | Production deployment | The site is live on a public URL (Vercel) and works end-to-end |
| G7 | Secrets hygiene | No API keys/secrets anywhere in code or Git — all via environment variables |
| G8 | Git history | Meaningful, incremental commits telling the story of the build |
| G9 | (Optional) Payment | Checkout runs through Paystack **Test Mode** end-to-end |

## 3. Scope

### In scope
- Product catalog (6 seeded products) with listing + detail pages
- Add-to-cart / update-quantity / remove, persisted in `localStorage`
- Google OAuth sign-in / sign-out (Auth.js v5 / NextAuth)
- Supabase Postgres database: `users`, `products`, `orders`, `order_items`
- Checkout flow gated behind sign-in, with Paystack Test Mode payment
- Order persistence tied to the user's account (server-side)
- Mailgun confirmation email after verified payment
- Vercel production deployment, README, full Git history

### Out of scope (v1)
- Real (live) payments — Test Mode only
- Admin dashboard / inventory management (products seeded via SQL)
- Delivery logistics, coupon codes, refunds, multi-currency
- Email marketing / newsletters (only transactional confirmation email)
- Mobile apps — responsive web only

## 4. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 15 (App Router) + TypeScript** | Required preference; route handlers keep payment/email logic server-side |
| Styling | **Tailwind CSS** (version scaffolded by `create-next-app`) | Required preference; brand tokens defined once, used everywhere |
| Auth | **Auth.js v5 (`next-auth@beta`)** with **Google provider** | The App Router–native release of NextAuth.js; JWT session strategy |
| Database | **Supabase** (Postgres) | Required preference; dashboard makes order inspection easy during testing |
| DB access | `@supabase/supabase-js` **server-side only** with service-role key | Auth is handled by NextAuth (not Supabase Auth), so all DB reads/writes happen in server components / route handlers; the service key never reaches the browser |
| Payments | **Paystack Test Mode** (initialize → redirect → verify → fulfill) | User's choice; test card checkout without real money |
| Email | **Mailgun** HTTP API (server-side fetch) | Required preference; no SDK needed, keeps deps light |
| Hosting | **Vercel** | Required preference; first-class Next.js support, env var UI |
| State | React Context + `localStorage` for cart; server components for orders | Cart survives refresh without login; orders are strictly server-side |

## 5. Feature Requirements

### FR1 — Shop / product experience
- **FR1.1** Home page shows the brand hero (name, tagline, brand colors) and the product grid.
- **FR1.2** Each product card shows: image, price (₦ formatted with `Intl.NumberFormat`), short description, and an "Add to cart" button.
- **FR1.3** Product detail page at `/products/[slug]` with full description, price, quantity selector, and add-to-cart.
- **FR1.4** Products are sourced from the database (Phase 3+); Phase 1 ships with a typed local catalog file of identical shape, so the swap is one line.
- **FR1.5** Responsive (mobile → desktop), light theme.

### FR2 — Authentication (Google OAuth)
- **FR2.1** "Sign in with Google" button in the header; uses Auth.js Google provider.
- **FR2.2** After sign-in, header shows user name + avatar and a "Sign out" button.
- **FR2.3** JWT session strategy; session persists across browser restarts.
- **FR2.4** On first sign-in (Phase 3+), the user is upserted into `public.users`.
- **FR2.5** Checkout and Orders pages redirect unauthenticated visitors to sign-in.

### FR3 — Database & order persistence
- **FR3.1** Tables: `users`, `products`, `orders`, `order_items` (schema in §8).
- **FR3.2** RLS enabled on all tables; only the server (service-role key) reads/writes.
- **FR3.3** Orders are stored server-side, keyed to `user_id`. Nothing about orders lives in `localStorage`.
- **FR3.4** Orders page (`/orders`) lists the signed-in user's orders: order number, date, status, items, total.
- **FR3.5** Atomic order creation via a Postgres function `create_order(...)` (inserts order + items in one transaction).

### FR4 — Cart & checkout
- **FR4.1** Add to cart from listing or detail page; cart count badge in header.
- **FR4.2** Cart page: change quantities, remove items, see totals; persisted in `localStorage` (survives refresh, works signed-out).
- **FR4.3** Checkout page (sign-in required): customer name, phone, delivery address, delivery notes → order summary → "Pay with Paystack".
- **FR4.4** Server route `/api/paystack/initialize` creates a Paystack transaction (secret key, server-only) with the cart total in kobo (₦ × 100) and a callback URL.
- **FR4.5** On callback, `/api/paystack/verify` verifies the transaction with Paystack; **only on `success`** does it call `create_order(...)`, clear the cart, and trigger the confirmation email.
- **FR4.6** Success page shows the order number; failure/cancel returns the user to checkout with a message.
- **FR4.7** An order must never be created without a verified Paystack payment.

### FR5 — Confirmation email (Mailgun)
- **FR5.1** Sent server-side immediately after successful payment verification.
- **FR5.2** To: customer email (from Google account). From: branded sender via Mailgun domain.
- **FR5.3** Nicely formatted responsive HTML matching the brand (green/gold/cream): logo header, order number, itemized list with prices, total, delivery details, thank-you note with tagline.
- **FR5.4** Email failure must not break checkout — order is already saved; log the error and show the success page regardless (best-effort with clear logging).

### FR6 — Deployment & secrets
- **FR6.1** Repo on GitHub with meaningful, incremental commits (one per logical unit of work).
- **FR6.2** Deployed to Vercel; all secrets configured as Vercel environment variables (Production + Preview).
- **FR6.3** `.env.local` git-ignored; `.env.example` committed with placeholder keys only.
- **FR6.4** README.md: local setup, account setup steps, env var reference table, deployment steps, testing checklist.

### FR7 — Payments (optional, approved: Paystack Test Mode)
- As FR4.4–FR4.6. Test-card and Paystack-dashboard verification instructions delivered in Phase 4.

## 6. Product Catalog (seed data)

| # | Slug | Name | Price (NGN) | Description |
|---|------|------|------------:|-------------|
| 1 | `classic-puff-puff` | Classic Puff-Puff | ₦2,500 | Soft, golden, slightly sweet dough balls. Pack of 12. |
| 2 | `crunchy-chin-chin` | Crunchy Chin-Chin | ₦1,800 | Crispy, lightly spiced chin-chin. 500g pack. |
| 3 | `mini-meat-pies` | Mini Meat Pies | ₦3,500 | Flaky pastry filled with spiced minced meat. Pack of 6. |
| 4 | `spring-rolls` | Spring Rolls (6pcs) | ₦2,800 | Crispy vegetable spring rolls. |
| 5 | `suya-chicken-wings` | Suya Chicken Wings | ₦4,500 | Spicy grilled chicken wings with suya spice. Pack of 8. |
| 6 | `mixed-small-chops-box` | Mixed Small Chops Box | ₦7,500 | Assorted: 6 puff-puff, 4 meat pies, 4 spring rolls, chin-chin. |

**Images:** branded local placeholders in `/public/products/` (committed to Git).
Easily swappable — replace the file, keep the filename. No external image URLs
that could break during evaluation.

## 7. Design System

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#0F6B3C` (deep green) | Buttons, headers, links, price accents |
| Secondary | `#E8B923` (warm gold) | Badges, highlights, hover states, tagline accents |
| Background | `#F9F5EB` (cream) | Page background, cards on white |
| Ink | `#1A1A1A` | Body text |
| Theme | Light | Store-wide |

- Typography: Next.js default font stack (no external font service needed).
- Look & feel: appetizing, clean, generous whitespace; rounded corners, soft shadows.
- Components: Header (logo, nav, cart badge, auth), ProductCard, QuantityStepper, Price display, Button variants, Footer.

## 8. Data Model (Supabase / Postgres)

```sql
-- Every table has RLS ENABLED. Only server-side code (service-role key) accesses them.

users
  id             uuid PK
  email          text UNIQUE NOT NULL
  name           text
  image          text
  created_at     timestamptz DEFAULT now()

products
  id             uuid PK
  slug           text UNIQUE NOT NULL
  name           text NOT NULL
  description    text NOT NULL
  price_kobo     int NOT NULL         -- ₦2,500 stored as 250000 (integer math, no float bugs)
  image_url      text NOT NULL        -- e.g. /products/puff-puff.png
  is_active      boolean DEFAULT true
  created_at     timestamptz DEFAULT now()

orders
  id             uuid PK
  order_number   text UNIQUE NOT NULL -- e.g. NB-20260210-A1B2
  user_id        uuid FK -> users.id
  status         text NOT NULL        -- 'pending' | 'paid' | 'failed'
  total_kobo     int NOT NULL
  currency       text DEFAULT 'NGN'
  customer_name  text NOT NULL
  customer_phone text NOT NULL
  address        text NOT NULL
  notes          text
  paid_at        timestamptz
  created_at     timestamptz DEFAULT now()

order_items
  id             uuid PK
  order_id       uuid FK -> orders.id ON DELETE CASCADE
  product_id     uuid FK -> products.id
  product_name   text NOT NULL        -- snapshot at purchase time
  unit_price_kobo int NOT NULL        -- snapshot at purchase time
  quantity       int NOT NULL

create_order(...)  -- Postgres function: inserts order + items atomically, returns order id
```

Money is stored as **integer kobo** everywhere; formatted to ₦ only at display time.

## 9. Integrations & Environment Variables

Every secret lives only in `.env.local` (local) and Vercel → Project → Settings →
Environment Variables (production). **Never in code, never in Git.**

| Env var | Where it comes from | Exposure |
|---------|--------------------:|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Public (URL alone is not a secret) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **Server only — never `NEXT_PUBLIC_`** |
| `AUTH_SECRET` | Generated (`openssl rand -base64 32`) | Server only |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth client | Server only (Auth.js) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client | Server only |
| `NEXT_PUBLIC_SITE_URL` | Vercel domain / `http://localhost:3000` | Public |
| `PAYSTACK_SECRET_KEY` | Paystack Dashboard → Settings → API Keys (Test) | **Server only** |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Paystack Dashboard → Settings → API Keys (Test) | Public |
| `MAILGUN_API_KEY` | Mailgun → API Keys | **Server only** |
| `MAILGUN_DOMAIN` | Mailgun → Domains | Server only |
| `MAILGUN_FROM` | Branded from-address on that domain | Server only |

**Rule of thumb used throughout this project:** anything prefixed
`NEXT_PUBLIC_` is browser-visible and must never be a true secret.

## 10. Non-Functional Requirements

- **Security:** service-role key, Paystack secret, and Mailgun key are referenced
  only in server components / route handlers. Paystack payments are verified
  server-side before any order is created. RLS enabled on all tables.
- **Performance:** product images local and reasonably sized; pages server-rendered by default.
- **Reliability:** email send is best-effort and must never fail the checkout
  response; order creation is atomic.
- **Accessibility:** semantic HTML, keyboard-reachable controls, sufficient color contrast.
- **Compatibility:** latest Chrome/Edge/Safari; mobile + desktop breakpoints.

## 11. Assumptions

1. Product images are local placeholders (swappable later).
2. Paystack stays in **Test Mode** for the entire project.
3. The buyer's Google account email receives the confirmation email (Mailgun
   sender domain verified per Phase 5 instructions).
4. Delivery is flat-address capture only (no logistics integration).
5. **Phase gate rule:** work on phase *N+1* starts only after explicit user confirmation of phase *N*.

## 12. Phased Delivery Plan

| Phase | Deliverable | Gate |
|------:|-------------|------|
| 1 | Project setup + this PRD + basic shop UI (all pages, brand styling) | ✅ confirm to proceed |
| 2 | Authentication — Google OAuth via Auth.js, header auth UI | ✅ confirm to proceed |
| 3 | Database schema + seeding + user sync + persisted orders page | ✅ confirm to proceed |
| 4 | Cart + Checkout + Paystack Test Mode (atomic order creation) | ✅ confirm to proceed |
| 5 | Mailgun confirmation email (formatted, brand-styled) | ✅ confirm to proceed |
| 6 | Production deployment on Vercel + env vars + README finalization | ✅ confirm to proceed |
| 7 | End-to-end testing checklist (mirrors §2 success criteria) | 🏁 done |

Each phase ends with: **what changed**, **what to test**, and **what to confirm**.


