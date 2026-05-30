-- S07: refine v_user_points for the per-tournament leaderboard surface.
--
-- Adds `position` via SQL window-rank (Constitution Critical Rule 6 — no ranking
-- in TypeScript) and excludes the 'tegelikud tulemused' singleton (Rule 1).
-- Column shape changes → DROP + CREATE per Critical Rule 7. v_user_cross_tournament
-- references v_user_points, so it is dropped and recreated in the same migration.

drop view if exists v_user_cross_tournament;
drop view if exists v_user_points;

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
