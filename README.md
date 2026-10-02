# 🍢 NaijaBites

**Fresh. Homemade. Delivered.**

A fully functional e-commerce store for homemade Nigerian snacks and small
chops — puff-puff, chin-chin, meat pies, spring rolls, suya wings and assorted
boxes — delivered fresh across Lagos.

> Built for **HNG 15 · Lesson 2**. This is **not a static site**: the project's
> core is real integrations — Google sign-in, a persistent Supabase database,
> durable order history, Paystack test-mode checkout and real Mailgun
> confirmation emails.

See [`PRD.md`](./PRD.md) for the full Product Requirements Document.

## Build status (phased)

| Phase | Deliverable | Status |
|------:|-------------|--------|
| 1 | Project setup + PRD + basic shop UI | ✅ Done |
| 2 | Authentication — Google OAuth (Auth.js) | ⏳ Next |
| 3 | Supabase schema + order persistence | ⏳ |
| 4 | Cart + Checkout + Paystack Test Mode | ⏳ |
| 5 | Mailgun confirmation email | ⏳ |
| 6 | Vercel deployment + environment variables | ⏳ |
| 7 | End-to-end testing checklist | ⏳ |

## Tech stack

- **Next.js 15.5** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** — brand tokens live in `app/globals.css`
- **Auth.js v5 (NextAuth)** with Google provider — *Phase 2*
- **Supabase** (Postgres) — *Phase 3*
- **Paystack** Test Mode — *Phase 4*
- **Mailgun** — *Phase 5*
- **Vercel** hosting — *Phase 6*

## Running locally

### Prerequisites
- Node.js 20+ (this repo was built on Node 24)
- npm 10+

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file from the template
#    (macOS/Linux) cp .env.example .env.local
#    (Windows)     copy .env.example .env.local
#    Phase 1 needs no keys yet — they are filled in during later phases.

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000 — you should see the shop with all 6 products.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Dev server with Turbopack (http://localhost:3000) |
| `npm run build` | Production build (also lints + type-checks) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

## Project structure

```
app/
  layout.tsx              Root layout (Header + Footer, metadata, fonts)
  page.tsx                Home: hero + menu grid
  products/[slug]/        Product detail pages (pre-rendered)
  cart/                   Cart (shell now, live cart in Phase 4)
  checkout/               Checkout (shell now, Paystack in Phase 4)
  orders/                 Order history (shell now, Supabase in Phase 3)
  not-found.tsx           Custom 404
  globals.css             Tailwind + NaijaBites brand tokens
components/               Header, Footer, ProductCard, QuantityStepper
lib/products.ts           Typed product catalog + ₦ price formatter
public/products/          Product images (replace files, keep filenames)
```

## Environment variables

**All secrets live in `.env.local` (local) and Vercel environment variables
(production). Never in code, never in Git.** `.env.local` is git-ignored;
`.env.example` documents every variable and is safe to commit.

| Variable | Exposure | Phase |
|----------|----------|------:|
| `NEXT_PUBLIC_SUPABASE_URL` | public | 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | 3 |
| `AUTH_SECRET` | server only | 2 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | server only | 2 |
| `NEXT_PUBLIC_SITE_URL` | public | 4 |
| `PAYSTACK_SECRET_KEY` | **server only** | 4 |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | public | 4 |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_FROM` | **server only** | 5 |

## Deployment

Planned for **Vercel** in Phase 6: push this repo to GitHub → import in Vercel →
add every variable from `.env.example` under Project → Settings → Environment
Variables → deploy.

## License

Private project — all rights reserved.
