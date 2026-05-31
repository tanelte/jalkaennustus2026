/**
 * Idempotent WC2026 seed.
 *
 * Writes:
 *   - 1 tournament (WC2026)
 *   - 48 teams across groups A-L
 *   - 104 games (72 group + 32 knockouts)
 *   - 8 stages with auto-derived opens_at/closes_at
 *   - 5 trivia questions (Q5 conditional on Q4)
 *
 * Idempotency: every upsert uses ON CONFLICT DO NOTHING. Replays produce
 * identical row counts; no duplicates.
 *
 * Connects via DATABASE_URL_ADMIN (session-pooled — Constitution Critical
 * Rule 4). Runs in a single transaction.
 */
import { Client } from 'pg';
import { config } from 'dotenv';
import {
  wc2026Tournament,
  wc2026Teams,
  wc2026Games,
  wc2026Questions,
} from '../db/seed-data/wc2026';
import { deriveStages } from '../db/seed-data/derive-stages';
import { seedLegacy } from '../db/seed-data/legacy/seed-legacy';

config({ path: '.env.local' });

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...fields }));
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    logLine('error', {
      operation: 'seed',
      outcome: 'error',
      message: 'DATABASE_URL_ADMIN is not set. See .env.local.example.',
    });
    return 1;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');

    // Tournament
    await client.query(
      `insert into tournaments (code, name, starts_at, ends_at)
       values ($1, $2, $3, $4)
       on conflict (code) do nothing`,
      [
        wc2026Tournament.code,
        wc2026Tournament.name,
        wc2026Tournament.startsAt,
        wc2026Tournament.endsAt,
      ],
    );
    const tournamentRow = await client.query<{ id: string }>(
      'select id from tournaments where code = $1',
      [wc2026Tournament.code],
    );
    const tournamentId = tournamentRow.rows[0]?.id;
    if (!tournamentId) {
      throw new Error('Tournament row not found after upsert.');
    }

    // Teams
    for (const team of wc2026Teams) {
      await client.query(
        `insert into teams (tournament_id, code, name_et, group_letter)
         values ($1, $2, $3, $4)
         on conflict (tournament_id, code) do nothing`,
        [tournamentId, team.code, team.nameEt, team.groupLetter],
      );
    }

    // Build code -> id lookup for resolving game team references
    const teamRows = await client.query<{ id: string; code: string }>(
      'select id, code from teams where tournament_id = $1',
      [tournamentId],
    );
    const teamIdByCode = new Map(teamRows.rows.map((r) => [r.code, r.id]));

    // Games
    for (const game of wc2026Games) {
      const homeId = game.homeCode ? (teamIdByCode.get(game.homeCode) ?? null) : null;
      const awayId = game.awayCode ? (teamIdByCode.get(game.awayCode) ?? null) : null;
      if (game.homeCode && !homeId) {
        throw new Error(`Unknown team code in game ${game.roundLabel}: ${game.homeCode}`);
      }
      if (game.awayCode && !awayId) {
        throw new Error(`Unknown team code in game ${game.roundLabel}: ${game.awayCode}`);
      }
      await client.query(
        `insert into games
           (tournament_id, stage_code, round_label, kickoff_at,
            team_home_id, team_away_id, double_points)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (tournament_id, round_label) do nothing`,
        [
          tournamentId,
          game.stageCode,
          game.roundLabel,
          game.kickoffAt,
          homeId,
          awayId,
          game.doublePoints,
        ],
      );
    }

    // Stages
    const stages = deriveStages(wc2026Tournament, wc2026Games);
    for (const stage of stages) {
      await client.query(
        `insert into stages (tournament_id, code, position, opens_at, closes_at)
         values ($1, $2, $3, $4, $5)
         on conflict (tournament_id, code) do nothing`,
        [tournamentId, stage.code, stage.position, stage.opensAt, stage.closesAt],
      );
    }

    // Questions — upsert prompt/shape/conditional so seed re-runs propagate
    // edited trivia text to prod. Deliberately do NOT touch correct_answer:
    // that column is operator-managed via the admin form and must survive
    // re-seeds.
    for (const q of wc2026Questions) {
      await client.query(
        `insert into questions
           (tournament_id, position, prompt_et, answer_shape, conditional_on_position)
         values ($1, $2, $3, $4, $5)
         on conflict (tournament_id, position) do update set
           prompt_et = excluded.prompt_et,
           answer_shape = excluded.answer_shape,
           conditional_on_position = excluded.conditional_on_position`,
        [tournamentId, q.position, q.promptEt, q.answerShape, q.conditionalOnPosition],
      );
    }

    const legacyCounts = await seedLegacy(client);

    await client.query('commit');

    // Final counts for the operator log line
    const counts = {
      tournaments: 1 + legacyCounts.tournaments,
      teams: wc2026Teams.length,
      games: wc2026Games.length,
      stages: stages.length,
      questions: wc2026Questions.length,
      legacy: legacyCounts,
    };
    logLine('info', {
      operation: 'seed',
      outcome: 'ok',
      tournament: wc2026Tournament.code,
      counts,
    });
    return 0;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    logLine('error', {
      operation: 'seed',
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
      operation: 'seed',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
