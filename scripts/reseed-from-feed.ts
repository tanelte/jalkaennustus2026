/**
 * Reset-and-reseed for WC2026: wipes the prediction-domain rows that depend on
 * the (about-to-be-replaced) teams + games, then drops those parent rows and
 * re-runs the regular seed against the post-draw snapshot.
 *
 * Why: the pre-draw placeholder seed picked the wrong group rosters and
 * fake kick-off times. This script applies the post-draw correction the PRD
 * called out, sourced from db/seed-data/wc2026-fixtures.json.
 *
 * Scope (wipes inside the WC2026 tournament only):
 *   - user_games (cascade from games delete)
 *   - user_teams (cascade from teams delete)
 *   - user_best_thirds (explicit; group-letter keyed)
 *   - user_questions (explicit; question id keyed)
 *   - stages (will be re-derived from new game dates)
 *   - questions
 *   - games
 *   - teams
 *
 * Preserves: groups, users, user_groups, login state, system singleton,
 * legacy_tournament_scores, the WC2026 tournament row itself.
 *
 * Re-runs the standard seed at the end so games rows are also linked to
 * match_id (populated from wc2026MatchIdByRoundLabel).
 */
import { Client } from 'pg';
import { config } from 'dotenv';
import {
  wc2026Tournament,
  wc2026Teams,
  wc2026Games,
  wc2026Questions,
  wc2026MatchIdByRoundLabel,
} from '../db/seed-data/wc2026';
import { deriveStages } from '../db/seed-data/derive-stages';

config({ path: '.env.local' });

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...fields }));
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    logLine('error', {
      operation: 'reseed_from_feed',
      outcome: 'error',
      message: 'DATABASE_URL_ADMIN missing',
    });
    return 1;
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');

    const tournamentRow = await client.query<{ id: string }>(
      'select id from tournaments where code = $1',
      [wc2026Tournament.code],
    );
    if (!tournamentRow.rows[0]) {
      throw new Error('WC2026 tournament row not found; run pnpm db:seed first');
    }
    const tournamentId = tournamentRow.rows[0].id;

    // 1) Wipe predictions + stages + questions scoped to this tournament. games
    //    + teams cascade to user_games + user_teams; we explicitly delete the
    //    others because they don't cascade.
    const wipeCounts: Record<string, number> = {};
    const wipes: Array<{ label: string; sql: string }> = [
      // Predictions whose FKs don't cascade-by-tournament:
      { label: 'user_best_thirds', sql: 'delete from user_best_thirds where tournament_id = $1' },
      { label: 'user_questions', sql: 'delete from user_questions using questions q where user_questions.question_id = q.id and q.tournament_id = $1' },
      // Tournament-scoped parent rows (cascade to predictions + each other):
      { label: 'stages', sql: 'delete from stages where tournament_id = $1' },
      { label: 'questions', sql: 'delete from questions where tournament_id = $1' },
      { label: 'games', sql: 'delete from games where tournament_id = $1' },
      { label: 'teams', sql: 'delete from teams where tournament_id = $1' },
    ];
    for (const w of wipes) {
      const r = await client.query(w.sql, [tournamentId]);
      wipeCounts[w.label] = r.rowCount ?? 0;
    }
    logLine('info', { operation: 'reseed_from_feed', step: 'wipe', counts: wipeCounts });

    // 2) Re-insert teams.
    for (const team of wc2026Teams) {
      await client.query(
        `insert into teams (tournament_id, code, name_et, group_letter)
         values ($1, $2, $3, $4)`,
        [tournamentId, team.code, team.nameEt, team.groupLetter],
      );
    }
    const teamRows = await client.query<{ id: string; code: string }>(
      'select id, code from teams where tournament_id = $1',
      [tournamentId],
    );
    const teamIdByCode = new Map(teamRows.rows.map((r) => [r.code, r.id]));

    // 3) Re-insert games, linking match_id from the snapshot.
    for (const game of wc2026Games) {
      const homeId = game.homeCode ? (teamIdByCode.get(game.homeCode) ?? null) : null;
      const awayId = game.awayCode ? (teamIdByCode.get(game.awayCode) ?? null) : null;
      if (game.homeCode && !homeId) {
        throw new Error(`Unknown team code in game ${game.roundLabel}: ${game.homeCode}`);
      }
      if (game.awayCode && !awayId) {
        throw new Error(`Unknown team code in game ${game.roundLabel}: ${game.awayCode}`);
      }
      const matchId = wc2026MatchIdByRoundLabel[game.roundLabel] ?? null;
      await client.query(
        `insert into games
           (tournament_id, stage_code, round_label, kickoff_at,
            team_home_id, team_away_id, double_points, match_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tournamentId,
          game.stageCode,
          game.roundLabel,
          game.kickoffAt,
          homeId,
          awayId,
          game.doublePoints,
          matchId,
        ],
      );
    }

    // 4) Re-derive stages from the new kickoff dates.
    const stages = deriveStages(wc2026Tournament, wc2026Games);
    for (const stage of stages) {
      await client.query(
        `insert into stages (tournament_id, code, position, opens_at, closes_at)
         values ($1, $2, $3, $4, $5)`,
        [tournamentId, stage.code, stage.position, stage.opensAt, stage.closesAt],
      );
    }

    // 5) Re-insert questions.
    for (const q of wc2026Questions) {
      await client.query(
        `insert into questions
           (tournament_id, position, prompt_et, answer_shape, conditional_on_position)
         values ($1, $2, $3, $4, $5)`,
        [tournamentId, q.position, q.promptEt, q.answerShape, q.conditionalOnPosition],
      );
    }

    await client.query('commit');

    logLine('info', {
      operation: 'reseed_from_feed',
      outcome: 'ok',
      tournament: wc2026Tournament.code,
      counts: {
        teams: wc2026Teams.length,
        games: wc2026Games.length,
        stages: stages.length,
        questions: wc2026Questions.length,
        match_ids_linked: Object.keys(wc2026MatchIdByRoundLabel).length,
      },
      wiped: wipeCounts,
    });
    return 0;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    logLine('error', {
      operation: 'reseed_from_feed',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    return 1;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logLine('error', {
      operation: 'reseed_from_feed',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
