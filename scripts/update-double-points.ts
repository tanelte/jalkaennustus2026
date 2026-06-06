/**
 * Update group-stage double_points flags to the curated marquee selection.
 *
 * - Sets double_points = TRUE on marquee fixtures (one per group).
 * - Sets double_points = FALSE on lopsided matchday-3 fixtures replaced by
 *   the marquee picks.
 * - Leaves the rest untouched.
 * - Re-scores any flipped game that already has a result.
 *
 * Idempotent. Single transaction. Connects via DATABASE_URL_ADMIN
 * (Constitution Rule 4). For recompute, falls back to the app `db` pool
 * which uses DATABASE_URL — both must be set when running.
 *
 * Usage:
 *   pnpm tsx scripts/update-double-points.ts
 */
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const TOURNAMENT_CODE = 'WC2026';

const SET_TRUE = [
  'A1-1',
  'B1-1',
  'C1-1',
  'D1-1',
  'D2-2',
  'E1-1',
  'F1-1',
  'G1-1',
  'H1-1',
  'I1-1',
  'I2-2',
  'J1-1',
  'J2-2',
  'K1-1',
  'L1-2',
];

const SET_FALSE = [
  'A3-1',
  'B3-1',
  'C3-1',
  'D3-1',
  'D3-2',
  'E3-1',
  'F3-1',
  'G3-1',
  'H3-2',
  'I3-1',
  'I3-2',
  'J3-1',
  'J3-2',
  'K3-1',
  'L3-1',
];

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...fields }));
}

async function main(): Promise<number> {
  const adminUrl = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!adminUrl) {
    logLine('error', {
      operation: 'update-double-points',
      outcome: 'error',
      message: 'DATABASE_URL_ADMIN is not set. See .env.local.example.',
    });
    return 1;
  }

  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const affected: Array<{ id: string; round_label: string; had_result: boolean }> = [];

  try {
    await client.query('begin');

    const tournamentRow = await client.query<{ id: string }>(
      'select id from tournaments where code = $1',
      [TOURNAMENT_CODE],
    );
    const tournamentId = tournamentRow.rows[0]?.id;
    if (!tournamentId) {
      throw new Error(`Tournament ${TOURNAMENT_CODE} not found.`);
    }

    const trueRes = await client.query<{ id: string; round_label: string; had_result: boolean }>(
      `update games
         set double_points = true
       where tournament_id = $1
         and round_label = any($2::text[])
         and double_points = false
       returning id, round_label,
         (score_home is not null and score_away is not null and final_status is not null) as had_result`,
      [tournamentId, SET_TRUE],
    );

    const falseRes = await client.query<{ id: string; round_label: string; had_result: boolean }>(
      `update games
         set double_points = false
       where tournament_id = $1
         and round_label = any($2::text[])
         and double_points = true
       returning id, round_label,
         (score_home is not null and score_away is not null and final_status is not null) as had_result`,
      [tournamentId, SET_FALSE],
    );

    affected.push(...trueRes.rows, ...falseRes.rows);

    const finalCounts = await client.query<{ count: string }>(
      `select count(*)::text as count
         from games
        where tournament_id = $1
          and stage_code = 'group_matches'
          and double_points = true`,
      [tournamentId],
    );

    logLine('info', {
      operation: 'update-double-points',
      step: 'updated',
      flipped_to_true: trueRes.rowCount,
      flipped_to_false: falseRes.rowCount,
      total_doubles_after: Number(finalCounts.rows[0]?.count ?? 0),
      with_results: affected.filter((r) => r.had_result).length,
    });

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    logLine('error', {
      operation: 'update-double-points',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    return 1;
  } finally {
    await client.end();
  }

  // Recompute scores for any flipped match that already has a result.
  // Uses the app's Drizzle `db` (DATABASE_URL pool). On prod pre-tournament
  // this is a no-op since no results exist yet. Dynamic import so dotenv
  // loads DATABASE_URL before lib/db.ts evaluates.
  const needsRecompute = affected.filter((r) => r.had_result);
  const { recomputeMatch } =
    needsRecompute.length > 0
      ? await import('../lib/recompute/match')
      : { recomputeMatch: undefined as never };
  for (const row of needsRecompute) {
    try {
      const result = await recomputeMatch(row.id);
      logLine('info', {
        operation: 'update-double-points',
        step: 'recompute',
        round_label: row.round_label,
        outcome: result.outcome,
        rescored: result.rescored,
      });
    } catch (err) {
      logLine('error', {
        operation: 'update-double-points',
        step: 'recompute',
        round_label: row.round_label,
        message: err instanceof Error ? err.message : String(err),
      });
      return 1;
    }
  }

  logLine('info', { operation: 'update-double-points', outcome: 'ok' });
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logLine('error', {
      operation: 'update-double-points',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
