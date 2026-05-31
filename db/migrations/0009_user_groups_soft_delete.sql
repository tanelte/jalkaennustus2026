-- Soft-delete for user_groups memberships (parity with legacy Rails portal).
--
-- Adds `deleted_at` to user_groups and re-creates the five aggregation views
-- so a soft-deleted membership disappears from any tournament whose
-- `starts_at` is *after* the deletion moment, while staying visible in
-- tournaments the user was active for. NULL `deleted_at` = active membership.
--
-- The legacy semantic compared `deleted_at` against `tournaments.created_at`,
-- but in this portal `tournaments.created_at` collapses to the seed date for
-- historical rows, so we anchor on `starts_at` instead — the natural "was
-- the user a member when the tournament started?" question.
--
-- Constitution Critical Rule 7: view shape / dependency changes are
-- forward-only DROP + CREATE. v_user_cross_tournament depends on
-- v_user_points, so it's dropped first and re-created last.
-- Constitution Critical Rule 9: this lands before WC2026 kickoff (2026-06-11).

alter table user_groups add column deleted_at timestamptz;

drop view if exists v_user_cross_tournament;
drop view if exists v_user_points;
drop view if exists v_user_finals_teams;
drop view if exists v_user_teams;
drop view if exists v_user_games;

create view v_user_points as
  with totals as (
    select
      u.id as user_id,
      ug.group_id,
      t.id as tournament_id,
      coalesce(
        (select sum(coalesce(ug_pts.points, 0))
           from user_games ug_pts
           join games g on g.id = ug_pts.game_id
          where ug_pts.user_id = u.id and g.tournament_id = t.id), 0
      )
      + coalesce(
        (select sum(coalesce(ut.points, 0))
           from user_teams ut
          where ut.user_id = u.id and ut.tournament_id = t.id), 0
      )
      + coalesce(
        (select sum(coalesce(ubt.points, 0))
           from user_best_thirds ubt
          where ubt.user_id = u.id and ubt.tournament_id = t.id), 0
      )
      + coalesce(
        (select sum(coalesce(uq.points, 0))
           from user_questions uq
           join questions q on q.id = uq.question_id
          where uq.user_id = u.id and q.tournament_id = t.id), 0
      ) as total_points
    from users u
    cross join tournaments t
    join user_groups ug on ug.user_id = u.id
    where u.is_system_user = false
      and coalesce(ug.deleted_at, current_timestamp) > t.starts_at
  )
  select
    user_id,
    group_id,
    tournament_id,
    total_points,
    rank() over (
      partition by group_id, tournament_id
      order by total_points desc
    )::integer as position
  from totals;

create view v_user_games as
  select
    ug.user_id,
    ugrp.group_id,
    g.id as game_id,
    g.tournament_id,
    g.stage_code,
    g.kickoff_at,
    ug.prediction,
    g.result_code,
    g.double_points,
    ug.points
  from user_games ug
  join games g on g.id = ug.game_id
  join tournaments t on t.id = g.tournament_id
  join user_groups ugrp on ugrp.user_id = ug.user_id
  where coalesce(ugrp.deleted_at, current_timestamp) > t.starts_at;

create view v_user_teams as
  select
    ut.user_id,
    ugrp.group_id,
    ut.tournament_id,
    ut.round,
    ut.slot,
    ut.team_id,
    ut.points
  from user_teams ut
  join tournaments t on t.id = ut.tournament_id
  join user_groups ugrp on ugrp.user_id = ut.user_id
  where coalesce(ugrp.deleted_at, current_timestamp) > t.starts_at;

create view v_user_finals_teams as
  select
    ut.user_id,
    ugrp.group_id,
    ut.tournament_id,
    ut.slot,
    ut.team_id,
    ut.points
  from user_teams ut
  join tournaments t on t.id = ut.tournament_id
  join user_groups ugrp on ugrp.user_id = ut.user_id
  where ut.round = 'final'
    and coalesce(ugrp.deleted_at, current_timestamp) > t.starts_at;

create view v_user_cross_tournament as
  select
    user_id,
    group_id,
    tournament_id,
    total_points,
    null::integer as finishing_position
  from v_user_points
  union all
  select
    user_id,
    group_id,
    tournament_id,
    total_points,
    finishing_position
  from legacy_tournament_scores;
