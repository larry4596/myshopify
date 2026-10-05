-- =============================================================================
-- NaijaBites — Lesson 3, P1: mobile one-time sign-in codes
-- Run in the Supabase SQL Editor AFTER (or before) supabase/cart-schema.sql.
-- Idempotent — safe to re-run.
--
-- WHY A TABLE AT ALL: the browser (Custom Tab) finishes Google sign-in with a
-- session cookie the app never sees, so the server hands the app a code
-- instead: 60-second TTL, single-use, consumed with ONE atomic
-- DELETE ... RETURNING (see lib/mobile-auth.ts consumeAuthCode). The table is
-- near-empty by design — every row dies within a minute of being written.
--
-- RLS enabled with ZERO policies, exactly like every other table in this
-- project: the anon/authenticated roles can read nothing; only the service
-- role (server-only, lib/supabase.ts) can touch these rows.
-- =============================================================================

create table if not exists public.mobile_auth_codes (
  code       text        primary key,           -- 256-bit random hex
  user_id    uuid        not null references public.users (id) on delete cascade,
  sub        text        not null,              -- Google account id
  name       text,
  email      text,
  image      text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null               -- created_at + 60 seconds
);

-- Supports the periodic purge of expired rows (issued on every code issue).
create index if not exists mobile_auth_codes_expires_at_idx
  on public.mobile_auth_codes (expires_at);

alter table public.mobile_auth_codes enable row level security; -- zero policies

-- Self-check (runs as postgres in the SQL Editor — must return 0):
-- select count(*) from public.mobile_auth_codes;