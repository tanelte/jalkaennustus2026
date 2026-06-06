-- S18: feed attribution on games rows.
-- match_id     - external football-data.org identifier; nullable until the first
--                poll links each fixture, partial-unique once linked.
-- result_source- which path wrote the current score row ('operator' wins over
--                'feed' on conflict per S18 AC). NULL when no result has been
--                written yet.
-- Constitution Critical Rule 9: forward-only.

alter table games
  add column if not exists match_id text;

create unique index if not exists games_match_id_unique
  on games (match_id)
  where match_id is not null;

alter table games
  add column if not exists result_source text;

alter table games
  drop constraint if exists games_result_source_check;

alter table games
  add constraint games_result_source_check
  check (result_source in ('operator', 'feed') or result_source is null);
