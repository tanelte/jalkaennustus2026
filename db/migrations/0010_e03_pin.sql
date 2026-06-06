-- E03 S01: per-user PIN foundation.
--
-- Adds two nullable columns on `users` (pin_hash, recovery_email) and the new
-- `user_pin_resets` table that S05 will use for forgot-PIN reset tokens. The
-- table lands now so every subsequent E03 story is additive-only — required
-- because WC2026 kicks off 2026-06-11 and Constitution Critical Rule 9
-- mandates forward-only migrations during a tournament window.
--
-- All changes here are additive: no DROPs, no NOT NULL on existing rows.

alter table users
  add column if not exists pin_hash text;

alter table users
  add column if not exists recovery_email text;

create table if not exists user_pin_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_pin_resets_user_active_idx
  on user_pin_resets (user_id, consumed_at, expires_at);
