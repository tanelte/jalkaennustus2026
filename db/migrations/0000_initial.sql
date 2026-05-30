-- Initial schema: groups, users, user_groups, tournaments, stages.
-- Constitution Critical Rule 9: forward-only during tournament windows.

create extension if not exists "pgcrypto";

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  is_system_user boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists user_groups (
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create table if not exists tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists stages (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments(id) on delete cascade,
  code text not null,
  position integer not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint stages_tournament_code_unique unique (tournament_id, code)
);
