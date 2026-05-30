-- Bootstrap the `tegelikud tulemused` singleton user.
-- Constitution Critical Rule 1: the literal string is sacred — same exact bytes everywhere.
-- This row is the system-owned writer of official tournament results.

insert into users (username, is_system_user)
values ('tegelikud tulemused', true)
on conflict (username) do nothing;
