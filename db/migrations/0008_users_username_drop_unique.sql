-- S13: same name in different groups is allowed; per-group uniqueness is
-- enforced at the application layer (app/select-user/actions.ts).
-- The system singleton stays uniquely identifiable via a partial unique index.

alter table users drop constraint users_username_key;

create unique index users_singleton_unique
  on users (is_system_user)
  where is_system_user = true;

-- Idempotency map for the legacy seed step. Lets seedLegacy() be re-run
-- without creating duplicate users.* rows, even though username is no longer
-- globally unique.
create table if not exists legacy_user_seed_map (
  legacy_id integer primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
