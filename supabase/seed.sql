-- =====================================================================================
-- NaijaBites — seed the 6 catalog products (PRD §6)
--
-- HOW TO RUN: after supabase/schema.sql — Supabase → SQL Editor → paste → Run.
-- Idempotent: re-running updates existing rows (matched on slug).
-- Values must stay in sync with lib/products.ts (the Phase 1 local catalog).
-- =====================================================================================

insert into public.products (slug, name, description, price_kobo, image_url, is_active)
values
  ('classic-puff-puff',   'Classic Puff-Puff',
   'Soft, golden, slightly sweet dough balls. Pack of 12.',
   250000, '/products/puff-puff.svg', true),

  ('crunchy-chin-chin',   'Crunchy Chin-Chin',
   'Crispy, lightly spiced chin-chin. 500g pack.',
   180000, '/products/chin-chin.svg', true),

  ('mini-meat-pies',      'Mini Meat Pies',
   'Flaky pastry filled with spiced minced meat. Pack of 6.',
   350000, '/products/meat-pies.svg', true),

  ('spring-rolls',        'Spring Rolls (6pcs)',
   'Crispy vegetable spring rolls.',
   280000, '/products/spring-rolls.svg', true),

  ('suya-chicken-wings',  'Suya Chicken Wings',
   'Spicy grilled chicken wings with suya spice. Pack of 8.',
   450000, '/products/suya-wings.svg', true),

  ('mixed-small-chops-box', 'Mixed Small Chops Box',
   'Assorted: 6 puff-puff, 4 meat pies, 4 spring rolls, chin-chin.',
   750000, '/products/small-chops-box.svg', true)

on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  price_kobo  = excluded.price_kobo,
  image_url   = excluded.image_url,
  is_active   = excluded.is_active;

-- =====================================================================================
-- OPTIONAL — preview the /orders page before Phase 4 checkout exists.
--
-- Run these in the SQL Editor AFTER you have signed in once with Google (that
-- creates your row in public.users). The SQL Editor runs as `postgres`, so the
-- revokes on create_order below do not apply here.
--
--   1. find your user id:
--        select id, email from public.users;
--
--   2. uncomment, paste that id, and Run — then reload /orders:
--
-- select public.create_order(
--   p_user_id        => '00000000-0000-0000-0000-000000000000',
--   p_items          => '[{"slug":"classic-puff-puff","quantity":2},
--                         {"slug":"suya-chicken-wings","quantity":1}]'::jsonb,
--   p_customer_name  => 'Test Customer',
--   p_customer_phone => '08030000000',
--   p_address        => '12 Allen Avenue, Ikeja, Lagos',
--   p_notes          => 'Ring the bell',
--   p_status         => 'paid'
-- );
--
-- Prices and the NB-YYYYMMDD-XXXX order number are generated server-side.
-- =====================================================================================
