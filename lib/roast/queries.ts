/**
 * Roast data-access helpers (S12). Read existing views and tables and
 * normalise rows into the pure PredictionRow shape consumed by
 * `lib/scoring/roast.ts`. No aggregation here — purely transport.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { PredictionRow } from '@/lib/scoring/roast';

const KNOCKOUT_STAGE_CODES = new Set(['r32', 'r16', 'qf', 'sf']);

/** Returns true when the FINAL fixture has a result attributed to anyone. */
export async function isFinalEnded(tournamentId: string): Promise<boolean> {
  const { rows } = await db.execute<{ result_code: string | null }>(sql`
    select result_code
      from games
     where tournament_id = ${tournamentId}
       and round_label = 'FINAL'
     limit 1
  `);
  return rows.length > 0 && rows[0]!.result_code !== null;
}

async function loadMatchPredictions(
  groupId: string,
  tournamentId: string,
): Promise<PredictionRow[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    game_id: string;
    stage_code: string;
    home_name: string | null;
    away_name: string | null;
    round_label: string;
    points: number | string | null;
  }>(sql`
    select
      ug.user_id,
      u.username,
      g.id as game_id,
      g.stage_code,
      g.round_label,
      th.name_et as home_name,
      ta.name_et as away_name,
      ug.points
    from user_games ug
    join games g on g.id = ug.game_id
    join users u on u.id = ug.user_id
    join user_groups ugrp on ugrp.user_id = ug.user_id
    left join teams th on th.id = g.team_home_id
    left join teams ta on ta.id = g.team_away_id
    where ugrp.group_id = ${groupId}
      and g.tournament_id = ${tournamentId}
      and u.is_system_user = false
      and g.result_code is not null
  `);

  return rows.map((r) => ({
    predictionKind:
      r.stage_code === 'group_matches'
        ? 'match'
        : KNOCKOUT_STAGE_CODES.has(r.stage_code)
        ? 'knockout'
        : 'final',
    predictionId: r.game_id,
    userId: r.user_id,
    username: r.username,
    label: matchLabel(r.home_name, r.away_name, r.round_label),
    points: toNumber(r.points),
  }));
}

async function loadTeamPredictions(
  groupId: string,
  tournamentId: string,
): Promise<PredictionRow[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    round: string;
    slot: string;
    team_name: string;
    points: number | string | null;
  }>(sql`
    select
      ut.user_id,
      u.username,
      ut.round,
      ut.slot,
      t.name_et as team_name,
      ut.points
    from user_teams ut
    join users u on u.id = ut.user_id
    join user_groups ugrp on ugrp.user_id = ut.user_id
    join teams t on t.id = ut.team_id
    where ugrp.group_id = ${groupId}
      and ut.tournament_id = ${tournamentId}
      and u.is_system_user = false
      and ut.points is not null
  `);

  return rows.map((r) => ({
    predictionKind: r.round === 'final' ? 'final' : 'knockout',
    predictionId: `${r.round}:${r.slot}`,
    userId: r.user_id,
    username: r.username,
    label: `${r.round.toUpperCase()} ${r.slot}: ${r.team_name}`,
    points: toNumber(r.points),
  }));
}

async function loadBestThirdsPredictions(
  groupId: string,
  tournamentId: string,
): Promise<PredictionRow[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    group_letter: string;
    points: number | string | null;
  }>(sql`
    select
      ubt.user_id,
      u.username,
      ubt.group_letter,
      ubt.points
    from user_best_thirds ubt
    join users u on u.id = ubt.user_id
    join user_groups ugrp on ugrp.user_id = ubt.user_id
    where ugrp.group_id = ${groupId}
      and ubt.tournament_id = ${tournamentId}
      and u.is_system_user = false
      and ubt.points is not null
  `);

  return rows.map((r) => ({
    predictionKind: 'best_thirds' as const,
    predictionId: r.group_letter,
    userId: r.user_id,
    username: r.username,
    label: `Best-thirds: grupp ${r.group_letter}`,
    points: toNumber(r.points),
  }));
}

async function loadTriviaPredictions(
  groupId: string,
  tournamentId: string,
): Promise<PredictionRow[]> {
  const { rows } = await db.execute<{
    user_id: string;
    username: string;
    position: number;
    prompt_et: string;
    points: number | string | null;
  }>(sql`
    select
      uq.user_id,
      u.username,
      q.position,
      q.prompt_et,
      uq.points
    from user_questions uq
    join questions q on q.id = uq.question_id
    join users u on u.id = uq.user_id
    join user_groups ugrp on ugrp.user_id = uq.user_id
    where ugrp.group_id = ${groupId}
      and q.tournament_id = ${tournamentId}
      and u.is_system_user = false
      and uq.points is not null
  `);

  return rows.map((r) => ({
    predictionKind: 'trivia' as const,
    predictionId: `Q${r.position}`,
    userId: r.user_id,
    username: r.username,
    label: `Q${r.position} — ${r.prompt_et}`,
    points: toNumber(r.points),
  }));
}

export async function loadAllPredictions(
  groupId: string,
  tournamentId: string,
): Promise<PredictionRow[]> {
  const [matches, teams, bestThirds, trivia] = await Promise.all([
    loadMatchPredictions(groupId, tournamentId),
    loadTeamPredictions(groupId, tournamentId),
    loadBestThirdsPredictions(groupId, tournamentId),
    loadTriviaPredictions(groupId, tournamentId),
  ]);
  return [...matches, ...teams, ...bestThirds, ...trivia];
}

function matchLabel(
  home: string | null,
  away: string | null,
  roundLabel: string,
): string {
  if (home && away) return `${home} – ${away}`;
  return roundLabel;
}

function toNumber(n: number | string | null | undefined): number {
  if (n === null || n === undefined) return 0;
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? v : 0;
}
