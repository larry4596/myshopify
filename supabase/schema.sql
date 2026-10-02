-- =====================================================================================
-- NaijaBites — Phase 3 database schema (PRD §8)
--
-- HOW TO RUN:
--   Supabase dashboard → SQL Editor → New query → paste this file → Run.
--   Safe to re-run: every object uses IF NOT EXISTS / OR REPLACE.
--
-- SECURITY MODEL (PRD FR3.2):
--   RLS is ENABLED on every table with ZERO policies, so anon/publishable
--   keys have no access at all. Only server-side code touches this database
--   using the secret/service-role key, which bypasses RLS. The dashboard's
--   SQL editor and Table Editor run as `postgres` and are unaffected.
-- =====================================================================================

-- ------------------------------------------------------------------ users (PRD §8)
-- `id` is a deterministic UUIDv5 derived from the Google account id (sub), so the
-- same Google account maps to the same row on every device (PRD G4).
create table if not exists public.users (
  id         uuid primary key,
  email      text unique not null,
  name       text,
  image      text,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- products (PRD §8)
-- Seeded by supabase/seed.sql; prices are integer kobo (₦2,500 -> 250000).
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text not null,
  price_kobo  integer not null check (price_kobo > 0),
  image_url   text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- orders (PRD §8)
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  order_number   text unique not null,            -- e.g. NB-20260210-A1B2
  user_id        uuid not null references public.users (id),
  status         text not null check (status in ('pending', 'paid', 'failed')),
  total_kobo     integer not null check (total_kobo >= 0),
  currency       text not null default 'NGN',
  customer_name  text not null,
  customer_phone text not null,
  address        text not null,
  notes          text,
  paid_at        timestamptz,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------- Phase 4 migration (PRD FR4.5/FR4.7)
-- ALREADY RAN THIS FILE IN PHASE 3? Just re-run the whole file — it is
-- idempotent (everything is `if not exists` / `create or replace`). By hand:
--   1. alter table public.orders add column if not exists paystack_reference text;
--   2. create unique index if not exists orders_paystack_reference_idx
--        on public.orders (paystack_reference) where paystack_reference is not null;
--   3. replace create_order with the version at the bottom of this file
--      (including its DROP statement and grants).
--
-- The Paystack reference that paid for the order. UNIQUE, so re-entering the
-- Paystack callback (refresh, retry, duplicate webhook) can never create a
-- second order for the same payment — the route returns the existing one.
alter table public.orders add column if not exists paystack_reference text;
create unique index if not exists orders_paystack_reference_idx
  on public.orders (paystack_reference) where paystack_reference is not null;

-- --------------------------------------------------------- order_items (PRD §8)
-- product_name / unit_price_kobo are snapshots taken at purchase time so
-- historical orders stay correct even if the product later changes.
create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  product_id      uuid references public.products (id),
  product_name    text not null,
  unit_price_kobo integer not null check (unit_price_kobo >= 0),
  quantity        integer not null check (quantity > 0)
);

-- -------------------------------------------------------------------- indexes
create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);
create index if not exists order_items_order_idx
  on public.order_items (order_id);

-- ------------------------------------------------------------------ RLS (FR3.2)
alter table public.users       enable row level security;
alter table public.products    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
-- Deliberately NO policies: with RLS enabled and no policies, anon/authenticated
-- (publishable key) is denied everything. The secret/service-role key bypasses
-- RLS, which is how all server-side reads/writes are allowed (FR3.2).

-- =========================================================== atomic order creation
-- PRD FR3.5: inserts the order + all of its items in ONE transaction.
-- Called server-side only: EXECUTE is revoked from anon/authenticated/public.
--
-- p_items: [{"slug": "classic-puff-puff", "quantity": 2}, ...]
--   Slugs (not uuids) come from the client cart so the local catalog and the
--   database share one stable key. Prices are ALWAYS read from public.products
--   here, never trusted from the caller (PRD FR4.7).
--
-- Returns the new order's id (uuid).
--
-- Phase 4 added `p_paystack_reference`. A new parameter would create an
-- OVERLOAD of the Phase 3 function rather than replacing it (so PostgREST
-- couldn't choose between them), hence the explicit DROP of the old signature
-- first. This is safe to re-run.
drop function if exists public.create_order(uuid, jsonb, text, text, text, text, text);

create or replace function public.create_order(
  p_user_id        uuid,
  p_items          jsonb,
  p_customer_name  text,
  p_customer_phone text,
  p_address        text,
  p_notes          text default null,
  p_status         text default 'paid',
  p_paystack_reference text default null
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id     uuid;
  v_order_number text;
  v_total        integer := 0;
  v_lines        jsonb := '[]'::jsonb;
  -- MUST be jsonb, never `record`: a `FOR ... IN <query>` target declared as
  -- `record` holds the whole ROW (here a 1-column record), so `v_item->>'slug'`
  -- fails with "operator does not exist: record ->> unknown". Declared as jsonb
  -- it holds the array element itself and ->> works.
  v_item         jsonb;
  v_product      record;
  v_quantity     integer;
  v_attempts     integer := 0;
begin
  -- ------------------------------ input validation
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'customer_name is required';
  end if;
  if coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'customer_phone is required';
  end if;
  if coalesce(trim(p_address), '') = '' then
    raise exception 'address is required';
  end if;
  if p_status not in ('pending', 'paid', 'failed') then
    raise exception 'Invalid status: %', p_status;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Order must contain at least one item';
  end if;

  -- the buyer must already exist (synced on Google sign-in, PRD FR2.4)
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception 'Unknown user: %', p_user_id;
  end if;

  -- ------------------------------ pass 1: price every line server-side
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
     where slug = v_item->>'slug';

    if not found then
      raise exception 'Unknown product: %',
        coalesce(v_item->>'slug', '(missing slug)');
    end if;
    if not v_product.is_active then
      raise exception 'Product not available: %', v_product.slug;
    end if;

    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when invalid_text_representation then
      raise exception 'Invalid quantity for %: %',
        v_product.slug, v_item->>'quantity';
    end;
    if v_quantity is null or v_quantity < 1 or v_quantity > 20 then
      raise exception 'Invalid quantity for %: %',
        v_product.slug, coalesce(v_item->>'quantity', '(missing)');
    end if;

    v_total := v_total + v_product.price_kobo * v_quantity;
    v_lines := v_lines || jsonb_build_object(
      'product_id',   v_product.id,
      'product_name', v_product.name,
      'unit_price_kobo', v_product.price_kobo,
      'quantity',     v_quantity
    );
  end loop;

  -- ------------------------------ unique order number: NB-YYYYMMDD-XXXX
  loop
    v_order_number := 'NB-' || to_char(now(), 'YYYYMMDD') || '-' ||
                      upper(substr(md5(random()::text || v_attempts::text), 1, 4));
    exit when not exists (
      select 1 from public.orders where order_number = v_order_number
    );
    v_attempts := v_attempts + 1;
    if v_attempts > 50 then
      raise exception 'Could not generate a unique order number';
    end if;
  end loop;

  -- ------------------------------ order + items atomically (one transaction)
  insert into public.orders (
    order_number, user_id, status, total_kobo,
    customer_name, customer_phone, address, notes, paid_at,
    paystack_reference
  ) values (
    v_order_number, p_user_id, p_status, v_total,
    trim(p_customer_name), trim(p_customer_phone), trim(p_address),
    p_notes,
    case when p_status = 'paid' then now() else null end,
    nullif(trim(coalesce(p_paystack_reference, '')), '')
  )
  returning id into v_order_id;

  -- `line(value)` names the single jsonb column explicitly, so `line.value` is
  -- unambiguously the element. `->>` only ever takes a jsonb operand — never a
  -- row/record (which is exactly what broke the pricing loop above).
  insert into public.order_items (
    order_id, product_id, product_name, unit_price_kobo, quantity
  )
  select
    v_order_id,
    (line.value->>'product_id')::uuid,
    line.value->>'product_name',
    (line.value->>'unit_price_kobo')::integer,
    (line.value->>'quantity')::integer
  from jsonb_array_elements(v_lines) as line(value);

  return v_order_id;
end;
$$;

-- Only the server (service-role / secret key) may execute create_order.
-- Supabase grants EXECUTE to anon/authenticated by default, so revoke explicitly:
revoke all on function public.create_order(uuid, jsonb, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_order(uuid, jsonb, text, text, text, text, text, text)
  to service_role;

