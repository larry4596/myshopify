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
| 4 | Cart + Checkout + Paystack Test Mode | ✅ Done |
| 5 | Mailgun confirmation email | ✅ Done |
| 6 | Vercel deployment + environment variables | ✅ Done |
| 7 | End-to-end testing checklist | ⏳ |

## Tech stack

- **Next.js 15.5** (App Router) + **TypeScript** + **React 19**
- **Tailwind CSS v4** — brand tokens live in `app/globals.css`
- **Auth.js v5 (NextAuth)** with Google provider — JWT sessions ✅ *Phase 2*
- **Supabase** (Postgres) — RLS-enabled tables, service-role access only ✅ *Phase 3*
- **Cart** — React Context + `localStorage` (survives refresh, works signed-out) ✅ *Phase 4*
- **Paystack** Test Mode — server-priced, verified server-side before fulfillment ✅ *Phase 4*
- **Mailgun** — server-side HTTP API via `fetch` (no SDK), branded confirmation email ✅ *Phase 5*
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

   ℹ️ **Already ran Phase 3's schema?** Don't skip this — Phase 4 extends it
   (the `orders.paystack_reference` column and the extra `create_order`
   argument). Running `schema.sql` again is safe: every statement is
   `if not exists` / `create or replace`. There are two ready-to-paste
   statements at the top of that file if you prefer doing it by hand.
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

**"already used by a different user id" — why checkout says `order_failed`:**
`users.id` is a UUIDv5 of Google's account id (`sub`, see `lib/users.ts`), and
Google issues a **different `sub` per OAuth client id**. Signing the same Gmail
account in through two different `GOOGLE_CLIENT_ID`s (e.g. localhost dev +
production) therefore derives two different ids for one email, and the
`unique(email)` constraint on `users` makes the second upsert fail — which stops
`createOrder` before the order is ever written.

`upsertUser()` now repairs this by itself: if the row holding that email has no
orders, it is stale profile data and gets replaced by the id in use now. If it
*does* own orders it refuses (rewriting history is not automatic) and logs what
to fix — reconcile it by hand in the SQL Editor:

```sql
-- inspect first
select id, email, created_at from public.users;
select id, order_number, user_id from public.orders;

-- move the orders onto the id your session uses today, then re-key the row
update public.orders set user_id = '<current session id>'
 where user_id = '<stale id>';
update public.users set id = '<current session id>'
 where id = '<stale id>';
```

Keep one `GOOGLE_CLIENT_ID` per environment so the id never drifts again.

### Paystack Test Mode setup (Phase 4)

Checkout runs through Paystack's **hosted** checkout page (redirect flow), so
only the server-side secret key is required — the public key is kept for a
future inline-JS integration.

1. Create a free account at [paystack.com](https://paystack.com) and make sure
   the dashboard is in **Test Mode** (toggle at the top of the sidebar).
2. **Settings → API Keys & Webhooks → Test keys**:
   - **Secret Key** (`sk_test_…`) → `PAYSTACK_SECRET_KEY` *(server-only —
     never prefix it with `NEXT_PUBLIC_`)*
   - **Public Key** (`pk_test_…`) → `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
3. Set `NEXT_PUBLIC_SITE_URL` to the origin Paystack should send the customer
   back to:
   - production: your Vercel URL, e.g. `https://naijabites.vercel.app`
     (**must be `https://`, never localhost**)
   - local testing: `http://localhost:3000` works (see the manual step below),
     or use an HTTPS tunnel, e.g. `ngrok http 3000` → the
     `https://<random>.ngrok.app` address it prints, for real redirects
4. Restart `npm run dev`.

> ⚠️ **Paystack will not redirect a customer to `http://localhost:3000`.**
> Paystack's docs on the callback URL say: *"Ensure that it only redirects to an
> HTTPS site"* and *"Ensure you don't use localhost as your callback URL"*. The
> initialize call still succeeds and the test card is still charged, but the
> browser is left sitting on `checkout.paystack.com` and **no order is created**
> until the verify URL is opened. What the app does depends on `NODE_ENV`:
>
> | Environment | callback URL is localhost / `http://` |
> |---|---|
> | **Production** (`npm run build` + `start`, Vercel) | **Refused with a 503** — no payment is started, the customer sees an explanation, and the server log says what to fix. Charging someone we can't send back to the store is worse than not charging. |
> | **Development** (`npm run dev`) | **Warns in the server log and still initializes.** The checkout page stays put and shows a *"Local testing"* panel with two steps. |
>
> **Local manual step.** On `localhost`, click **Pay with Paystack**, then in the
> panel: (1) open the Paystack checkout in the new tab and pay with the test card,
> (2) come back and open the verify link it shows —
> `http://localhost:3000/api/paystack/verify?reference=<reference>` — which
> verifies the payment with Paystack and creates the order. The panel survives a
> refresh and is cleared automatically once the order exists.

**The callback URL is sent with every transaction — leave the dashboard field
blank.** Paystack's Initialize Transaction endpoint takes a `callback_url` that
*"overrides the callback url provided on the dashboard for this transaction"*,
so **Paystack dashboard → Settings → Callback URL can stay empty**. The value is
`<origin>` + `/api/paystack/verify`, built in one place in
[`lib/site-url.ts`](./lib/site-url.ts) (always absolute, never a double slash),
echoed in the initialize response for debugging, and logged server-side on every
attempt.

**Which origin is used.** Paystack returns the customer to that URL as a fresh
cross-site navigation, so it must be the host the customer's session cookie
lives on (on Vercel the production alias, the `*.vercel.app` deployment URL,
previews and any custom domain are all *different* hosts). `resolveSiteUrl`
therefore tries, in order:

1. **the request's own origin** (proxy-aware — on Vercel this is always the
   domain the customer is actually browsing on)
2. `NEXT_PUBLIC_SITE_URL` — keep it set to your `https://` production URL; it is
   also the source used when there is no request at all
3. `VERCEL_URL` (set automatically by Vercel)
4. `http://localhost:3000`

```text
[paystack] initialize ref=NB-m9k2x1-a1b2c3d4 amount=950000 kobo callback_url=https://abc123.ngrok.app/api/paystack/verify (from request)
```

Once the payment is done, Paystack returns the browser to
`https://<your-domain>/api/paystack/verify`, which calls Paystack's verify API,
compares the amount against the server-priced cart, and only then creates the
order. (A webhook is the more robust option — Paystack's own docs call callbacks
"not the only way of returning value" — and remains a possible hardening: order
fulfilment would no longer depend on the browser coming back at all.)

**Callback fallbacks** — a customer who has paid can never lose their order or
their confirmation:

- **Replayed / refreshed callback** — if the reference already produced an
  order, the route redirects straight to the receipt *with that order's id*, so
  re-opening the callback renders the same confirmation again and can never
  duplicate the order (`orders.paystack_reference` is unique).
- **Callback without a session** — if the session cookie didn't survive the
  round trip (different host, another tab, hand-opened link), the payer recorded
  in Paystack's `metadata` at initialize time identifies who the payment belongs
  to — never the query string — and the order is still created, with a warning
  in the server log naming the host mismatch.
- **Receipt not readable yet** — `/checkout/success` never shows a bare 404 for
  a paid order: it resolves the receipt by `orderId` *or* by the Paystack
  `ref`, and if the row still can't be read it renders a *"We're confirming your
  payment"* card with the reference and a **Check my payment again** button that
  re-runs the verify route. A signed-out visitor keeps the full receipt URL
  through `/signin`.

**Paystack test card**

| Field | Value |
|-------|-------|
| Card number | `4084 0840 8408 4081` |
| CVV | `408` |
| Expiry | any future date |
| PIN | `0000` |
| OTP | `123456` |

Other test numbers (declined / insufficient funds) are listed in Paystack's
[test payments docs](https://paystack.com/docs/payments/test-payments/).

**What to test (G9):**
- *Prerequisite:* in production the callback origin must be an `https://` URL —
  on Vercel that is taken from the request itself and is always https; a
  non-HTTPS origin with no env fallback refuses to start a payment (503).
  Locally, either use an HTTPS tunnel for normal redirects, or stay on
  `http://localhost:3000` and finish each payment by opening the verify link the
  checkout page shows.
- Add a few items → **Cart** shows them with a live header badge, and they
  survive a page refresh.
- **Proceed to checkout** while signed out → redirected to `/signin`, then back
  to checkout with the cart intact.
- Fill in name/phone/address → **Pay with Paystack** → redirected to Paystack →
  pay with the test card → redirected back to **/checkout/success**.
- The success page shows the **order number** (e.g. `NB-20260210-A1B2`), the
  itemised total and a "View receipt" link; the cart is now empty.
- **/orders** lists the new order — and it is still there after signing out,
  closing the browser and signing in again (G2/G4).
- Paystack **Dashboard → Transactions** shows the same reference, marked
  *success* (test mode).
- **Idempotency:** refresh the success page / re-open the callback URL → the
  same receipt renders again and no duplicate order is created
  (`orders.paystack_reference` is unique).
- **Failure path:** on Paystack, choose *Cancel* or use a declined test card →
  you land back on `/checkout` with a readable message and **no order row** is
  created (FR4.7).

### Mailgun setup (Phase 5)

After a verified payment, `/api/paystack/verify` sends the buyer a branded
confirmation email (order number, itemised lines, total, delivery details)
through Mailgun's HTTP API — plain `fetch`, no SDK (`lib/mailgun.ts`).

The send is **best-effort (FR5.4)**: the order row is already saved, so a
Mailgun outage only logs `[mailgun] confirmation FAILED …` in the server log —
the customer still lands on the success page. Sending is skipped with a clear
log line when the three variables below are missing or still placeholders.

1. Create an account at [mailgun.com](https://www.mailgun.com) (the free trial
   includes 5,000 emails/month for 30 days).
2. **Sending → Domain List → Add New Domain**: use your own domain (e.g.
   `mg.yourdomain.com`) and add the DNS records Mailgun shows (SPF/DKIM) so
   mail is signed. On a sandbox domain (`*.mailgun.org`) emails only reach
   **Authorized Recipients** you add under **Sending → Authorized Recipients**
   — fine for testing, but real buyers must receive it too, so prefer a
   verified custom domain for submission.
3. **Sending → API Keys → Create API Key** → `MAILGUN_API_KEY`
   *(server-only — never prefix it with `NEXT_PUBLIC_`)*.
4. The domain you'll send through → `MAILGUN_DOMAIN` (e.g. `mg.yourdomain.com`
   — just the domain, no `https://`).
5. Branded sender on that domain → `MAILGUN_FROM`, e.g.
   `NaijaBites <orders@mg.yourdomain.com>`.
6. Restart `npm run dev`.

**What to test (G5):**
- Complete a test-mode checkout (Phase 4) → within a few seconds the buyer's
  Google inbox shows an email from your `MAILGUN_FROM` address with subject
  `Order confirmed — NB-… · NaijaBites`.
- The email matches the receipt: same order number, same lines and prices,
  same total and delivery address, green/gold/cream branding and a working
  **View your receipt** button.
- Mailgun **Logs** shows the message with status `delivered` (or `accepted`
  while the trial warms up; sandbox sends go to the authorized recipient).
- Temporarily blank `MAILGUN_API_KEY` → checkout still succeeds and the server
  log shows the skip warning (FR5.4).

**If nothing arrives, check the log line first:**
- `Free accounts are for test purposes only… add the address to your authorized
  recipients` (HTTP 403) — a sandbox domain (`*.mailgun.org`) can only send to
  addresses listed under **Sending → Authorized Recipients**. Add the buyer's
  address, or move to a verified custom domain before real customers.
- `from` / `Mailgun responded with HTTP 400` — check `MAILGUN_FROM` is only the
  value: `MAILGUN_FROM=NaijaBites <orders@mg.yourdomain.com>`. A pasted prefix
  (e.g. `MAILGUN_FROM=MAILGUN_FROM=NaijaBites …`) makes the whole string the
  sender, which Mailgun rejects.
- `confirmation skipped … order … could not be read back` — the order write
  failed first, so fix the Supabase error above before chasing email.

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
  layout.tsx              Root layout (AuthProvider + CartProvider + Header + Footer)
  page.tsx                Home: hero + menu grid
  products/[slug]/        Product detail pages (pre-rendered)
  signin/                 Branded Google sign-in page (Auth.js pages.signIn)
  cart/                   Cart page (live localStorage cart)
  checkout/               Checkout: delivery form + summary + "Pay with Paystack"
  checkout/success/       Post-payment receipt (order number, items, total)
  orders/                 Order history from Supabase (sign-in required)
  api/auth/[...nextauth]/ Auth.js route handler (signin/signout/callback/session)
  api/paystack/initialize/ Creates the Paystack transaction, server-priced (FR4.4)
  api/paystack/verify/    Paystack callback: verify → create order (FR4.5-FR4.7)
  not-found.tsx           Custom 404
  globals.css             Tailwind + NaijaBites brand tokens
auth.ts                   Auth.js v5 config (Google provider, JWT sessions,
                          user sync on sign-in)
components/               Header, Footer, ProductCard, QuantityStepper,
                          AuthProvider, AuthMenu, SignInButton, OrderCard,
                          CartProvider, CartNavLink, CartView, AddToCartButton,
                          AddToCartPanel, CheckoutForm, ClearCartOnSuccess
lib/products.ts           Typed product catalog + ₦ price formatter (client-safe)
lib/supabase.ts           Server-only service-role client (RLS bypass)
lib/users.ts              UUIDv5 user ids + public.users sync (FR2.4)
lib/orders.ts             Order history query + idempotent create_order wrapper
lib/pricing.ts            Server-side cart pricing (never trusts the browser)
lib/paystack.ts           Server-only Paystack initialize/verify client
lib/mailgun.ts            Server-only Mailgun HTTP client (FR5.1)
lib/order-email.ts        Branded confirmation email HTML + text (FR5.3)
lib/site-url.ts           The origin Paystack should call back to
lib/database.types.ts     Hand-written Supabase table types
supabase/schema.sql       Tables, RLS, create_order function (run in SQL Editor)
supabase/seed.sql         The 6 products (run after schema.sql)
types/next-auth.d.ts      Session type augmentation (session.user.id)
public/products/          Product images (replace files, keep filenames)
```

## How the payment flow is secured

The browser is never trusted with money (PRD FR4.7):

1. The cart in `localStorage` holds **only** `{slug, quantity}` — no prices.
2. `/api/paystack/initialize` reads every price from `products` and computes
   the total **server-side** before telling Paystack how much to charge.
3. The delivery details travel in the Paystack `metadata`, and are read back
   from Paystack's own verify response — never from the browser.
4. `/api/paystack/verify` only creates an order when Paystack reports
   `status: "success"`, the amount matches the re-priced cart, and the payment
   belongs to the signed-in user.
5. `create_order` re-prices every line **again** inside the database
   transaction, so even a direct RPC call cannot set its own prices.
6. `orders.paystack_reference` is unique → refreshing the callback (or a
   duplicate callback) can never create a second order for the same payment.

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

Live on **Vercel** (Phase 6): the repo is pushed to GitHub and imported into
Vercel, with every variable from `.env.example` under Project → Settings →
Environment Variables (Production *and* Preview) before each deploy.

- Set `NEXT_PUBLIC_SITE_URL` to the production `https://` URL. The callback
  prefers the request's own origin, so payments still work if this is missing —
  but keeping it correct keeps the log and the fallbacks unambiguous.
- After changing any environment variable, hit **Redeploy** — values are read
  at build/request time and `NEXT_PUBLIC_*` ones are baked in at build time.
- Paystack dashboard → Settings → Callback URL stays **blank** (every
  transaction carries its own `callback_url`).
- Checkout only refuses a payment (503) when the callback URL that would be
  handed to Paystack is not a public HTTPS URL — on Vercel that never happens.

## License

Private project — all rights reserved.
#   m y s h o p i f y  
 #   m y s h o p i f y  
 