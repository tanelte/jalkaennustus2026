-- S06 follow-up: knockout finish-type for the operator surface.
-- A/B suffix on knockout result codes encodes normal-time vs extra-time / penalties.
-- Nullable: group-stage games leave it NULL and the group mapper ignores it.
-- Constitution Critical Rule 9: forward-only.

alter table games
  add column if not exists finish_type text;

alter table games
  drop constraint if exists games_finish_type_check;

alter table games
  add constraint games_finish_type_check
  check (finish_type in ('NORMAL_TIME', 'EXTRA_TIME', 'PENALTIES') or finish_type is null);
