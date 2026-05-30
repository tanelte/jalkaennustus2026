-- Aggregation views (skeleton). Per-story refinements (S06, S08, S09, S14, S15)
-- DROP + CREATE these when removing columns (Constitution Critical Rule 7).
-- Scoring (per-prediction → points) stays in TypeScript; aggregation in SQL views.

create or replace view v_user_points as
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
  join user_groups ug on ug.user_id = u.id;

create or replace view v_user_games as
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
  join user_groups ugrp on ugrp.user_id = ug.user_id;

create or replace view v_user_teams as
  select
    ut.user_id,
    ugrp.group_id,
    ut.tournament_id,
    ut.round,
    ut.slot,
    ut.team_id,
    ut.points
  from user_teams ut
  join user_groups ugrp on ugrp.user_id = ut.user_id;

create or replace view v_user_finals_teams as
  select
    ut.user_id,
    ugrp.group_id,
    ut.tournament_id,
    ut.slot,
    ut.team_id,
    ut.points
  from user_teams ut
  join user_groups ugrp on ugrp.user_id = ut.user_id
  where ut.round = 'final';

create or replace view v_user_cross_tournament as
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
