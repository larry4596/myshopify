-- =====================================================================================
-- NaijaBites — LESSON 3 (Expo mobile app) cart migration
--
-- Adds ONE table: public.cart_items, so the cart can live in Postgres and sync
-- between the Next.js web app and the Expo Android app (PRD-LESSON3 §6).
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this file → Run.
--   Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE.
--
-- SECURITY MODEL: identical to supabase/schema.sql (FR3.2) — RLS is ENABLED with
-- ZERO policies, so the anon/publishable key is denied everything. Every read and
-- write goes through server-side code using the secret/service-role key (the new
-- /api/mobile/* routes and the web CartProvider). The anon key is never shipped
-- inside the APK.
-- =====================================================================================

-- ------------------------------------------------------------------- cart_items
-- One row per (customer, product). Mirrors the web cart's `{slug, quantity}` shape:
--
--   • keyed on product_id, not a raw slug, so a renamed/removed product is
--     handled by the foreign key instead of leaving orphan rows behind. The API
--     still speaks slugs (products.slug is UNIQUE, so the mapping is 1:1) which
--     keeps `priceCart` and `create_order` completely unchanged.
--
--   • quantity is capped at 20 — the SAME window `create_order` enforces
--     (components/CartProvider.tsx MAX_CART_QUANTITY), so a synced cart can
--     never be rejected at checkout.
--
--   • NO price column, ever. Prices are always read from public.products at
--     render time and re-priced again server-side before payment (FR4.7).
create table if not exists public.cart_items (
  user_id    uuid    not null references public.users (id) on delete cascade,
  product_id uuid    not null references public.products (id) on delete cascade,
  quantity   integer not null check (quantity > 0 and quantity <= 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- The primary key already covers `where user_id = $1` lookups (it is a leftmost
-- prefix), so no extra index is needed here.

-- ------------------------------------------------------------------- RLS (FR3.2)
alter table public.cart_items enable row level security;
-- Deliberately NO policies — see the security note at the top of this file.

-- =========================================================================================
-- merge_cart — fold a signed-out guest cart into a signed-in customer's saved cart.
--
-- WHY A FUNCTION: merging is a read-modify-write per line ("existing + incoming"),
-- so doing it from the client would be a race between the phone and a web tab.
-- Inside one transaction it is atomic. It also lets us sum and clamp in one call.
--
-- p_items: [{"slug": "classic-puff-puff", "quantity": 2}, ...]
--   Unknown / inactive / malformed entries are SKIPPED rather than raising, so a
--   guest cart carrying a product that was since deleted can never block sign-in.
--
-- Returns: the caller's full cart as setof public.cart_items.
-- =========================================================================================
drop function if exists public.merge_cart(uuid, jsonb);

create or replace function public.merge_cart(
  p_user_id uuid,
  p_items   jsonb
) returns setof public.cart_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item     jsonb;
  v_product  record;
  v_incoming integer;
  v_current  integer;
begin
  -- the buyer must already exist (synced on Google sign-in, FR2.4)
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Unknown user: %', p_user_id;
  end if;

  if p_items is not null and jsonb_typeof(p_items) = 'array' then
    for v_item in select * from jsonb_array_elements(p_items)
    loop
      select * into v_product from public.products
       where slug = v_item->>'slug' and is_active;

      if not found then continue; end if;   -- unknown or delisted — skip

      -- guard the cast: a non-numeric quantity must not abort the whole merge
      begin
        v_incoming := (v_item->>'quantity')::integer;
      exception when invalid_text_representation then
        continue;
      end;

      if v_incoming is null or v_incoming < 1 then continue; end if;

      select quantity into v_current from public.cart_items
       where user_id = p_user_id and product_id = v_product.id;

      -- sum, then clamp to the same 1..20 window the server-side order enforces
      v_incoming := least(20, coalesce(v_current, 0) + v_incoming);

      insert into public.cart_items (user_id, product_id, quantity)
      values (p_user_id, v_product.id, v_incoming)
      on conflict (user_id, product_id)
      do update set quantity = excluded.quantity, updated_at = now();
    end loop;
  end if;

  return query
    select ci.* from public.cart_items ci where ci.user_id = p_user_id;
end;
$$;

-- Only the server (service-role / secret key) may execute merge_cart. Supabase grants
-- EXECUTE to anon/authenticated by default, so revoke explicitly — same as create_order.
revoke all on function public.merge_cart(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_cart(uuid, jsonb) to service_role;

-- =========================================================================================
-- OPTIONAL self-check — run these to confirm the migration worked:
--
--   -- 1. the table exists:
--   select * from public.cart_items limit 10;
--
--   -- 2. merge fake lines for YOUR OWN user and check they sum + clamp:
--   select public.merge_cart(
--     (select id from public.users order by created_at limit 1),
--     '[{"slug":"classic-puff-puff","quantity":3},
--       {"slug":"suya-chicken-wings","quantity":25},
--       {"slug":"does-not-exist","quantity":1}]'::jsonb
--   );
--   -- expect: puff-puff 3, wings 20 (clamped), the unknown slug ignored.
--
--   -- 3. undo the test data:
--   delete from public.cart_items;
--
-- Step 2 is safe — it only ever touches YOUR cart.
-- =========================================================================================