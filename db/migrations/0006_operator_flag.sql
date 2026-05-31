-- S06: add is_operator flag on users for admin surface gating.
-- Constitution Critical Rule 9: forward-only.

alter table users
  add column if not exists is_operator boolean not null default false;
