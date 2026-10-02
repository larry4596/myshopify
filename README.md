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
| 2 | Authentication — Google OAuth (Auth.js) | ✅ Done |
| 3 | Supabase schema + order persistence | ✅ Done |
| 4 | Cart + Checkout + Paystack Test Mode | ⏳ Next |
| 5 | Mailgun confirmation email | ⏳ |
| 6 | Vercel deployment + environment variables | ⏳ |
| 7 | End-to-end testing checklist | ⏳ |

## Tech stack

- **Next.js 15.5** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** — brand tokens live in `app/globals.css`
- **Auth.js v5 (NextAuth)** with Google provider — JWT sessions ✅ *Phase 2*
- **Supabase** (Postgres) — RLS-enabled tables, service-role access only ✅ *Phase 3*
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
#    Then set AUTH_SECRET (Phase 2 needs it):
#      openssl rand -base64 32
#    and fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (see below).
#    Later phases add the Supabase, Paystack and Mailgun keys.

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000 — you should see the shop with all 6 products.

### Google OAuth setup (Phase 2)

Sign-in uses a real Google OAuth client:

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   (create a project if you don't have one).
2. **Configure the OAuth consent screen** (External is fine) — add your Google
   account email as a test user while the app is in testing mode.
3. **Create credentials → OAuth client ID → Web application** with:
   - *Authorized JavaScript origins*: `http://localhost:3000`
   - *Authorized redirect URIs*: `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID and secret into `.env.local`, then restart `npm run dev`.

**What to test:** click **Sign in with Google** in the header → Google
consent → back on the site your avatar + name appear; `/checkout` and
`/orders` redirect to `/signin` when signed out; **Sign out** returns the
header to the signed-in/signed-out states above.

### Supabase setup (Phase 3)

Order history lives in Supabase (Postgres). One-time setup:

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql) and **Run**. Then do the
   same with [`supabase/seed.sql`](./supabase/seed.sql) (the 6 products).
3. Go to **Settings → API Keys** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Secret key** (`sb_secret_…`, the service-role replacement) →
     `SUPABASE_SERVICE_ROLE_KEY`

     ⚠️ The **publishable** key (`sb_publishable_…`) is the *anon*
     equivalent — RLS applies to it and every table denies it. Server code
     must use the **secret** key, which bypasses RLS (PRD FR3.2).
4. Restart `npm run dev`.

**What to test:**
- Sign in with Google → open **Table Editor → users** → your row appears
  (name/email/photo synced on sign-in, FR2.4).
- Visit **/orders** while signed in → "No orders yet" state; after Phase 4
  checkout your paid orders render here — order number, date, status,
  itemised lines, total (FR3.4).
- **Persistence (G2/G4):** orders are rows in Supabase — sign out, close the
  browser completely, sign in again → history still there.
- To preview the filled-in list before Phase 4, insert a demo order in the
  SQL Editor using your `users.id` (see the comment at the bottom of
  `supabase/seed.sql`).

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
  layout.tsx              Root layout (AuthProvider + Header + Footer, metadata, fonts)
  page.tsx                Home: hero + menu grid
  products/[slug]/        Product detail pages (pre-rendered)
  signin/                 Branded Google sign-in page (Auth.js pages.signIn)
  cart/                   Cart (shell now, live cart in Phase 4)
  checkout/               Checkout (sign-in required; Paystack in Phase 4)
  orders/                 Order history from Supabase (sign-in required)
  api/auth/[...nextauth]/ Auth.js route handler (signin/signout/callback/session)
  not-found.tsx           Custom 404
  globals.css             Tailwind + NaijaBites brand tokens
auth.ts                   Auth.js v5 config (Google provider, JWT sessions,
                          user sync on sign-in)
components/               Header, Footer, ProductCard, QuantityStepper,
                          AuthProvider, AuthMenu, SignInButton, OrderCard
lib/products.ts           Typed product catalog + ₦ price formatter
lib/supabase.ts           Server-only service-role client (RLS bypass)
lib/users.ts              UUIDv5 user ids + public.users sync (FR2.4)
lib/orders.ts             Order history query + create_order RPC wrapper
lib/database.types.ts     Hand-written Supabase table types
supabase/schema.sql       Tables, RLS, create_order function (run in SQL Editor)
supabase/seed.sql         The 6 products (run after schema.sql)
types/next-auth.d.ts      Session type augmentation (session.user.id)
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
