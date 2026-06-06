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

// Curated double-points selection for the WC2026 post-draw fixture set.
// Strategy: one marquee MD1/MD2 fixture per group (the strongest pair meet
// early, classic rivalry, or genuine toss-up) plus the best-matched MD3
// fixture per group (top-two collision or 2nd-spot decider). Edit and re-run
// this script if the operator decides to re-curate during the tournament.
const SET_TRUE = [
  // Marquee MD1/MD2
  'A2-2', // MEX vs KOR — host vs S. Korea, group's top two
  'B1-2', // QAT vs SUI — Asian Cup champ vs Switzerland
  'C1-1', // BRA vs MAR — Brazil opener vs WC2022 semi-finalist
  'D1-2', // AUS vs TUR — close mid-tier sides
  'E2-1', // GER vs CIV — Germany vs rising Ivory Coast
  'F1-1', // NED vs JPN — WC2022 R16 rematch
  'G2-1', // BEL vs IRN — group's top two early
  'H1-2', // KSA vs URY — Asian champ vs South American power
  'I1-1', // FRA vs SEN — long-standing rivalry
  'J2-1', // ARG vs AUT — defending champ vs Euro qualifier
  'K1-1', // POR vs COD — Portugal opener (likely Ronaldo's last WC)
  'L1-1', // ENG vs CRO — WC2018 SF rematch
  // MD3 deciders
  'A3-1', // CZE vs MEX — 2nd-spot fight vs host
  'B3-1', // SUI vs CAN — group's top two finale
  'C3-2', // SCO vs BRA — Scotland's upset chance
  'D3-1', // TUR vs USA — 1st-place decider
  'E3-1', // ECU vs GER — advance-or-go-home for Ecuador
  'F3-2', // JPN vs SWE — 2nd-spot decider
  'G3-2', // EGY vs IRN — 2nd-spot battle
  'H3-1', // URY vs ESP — group's top two
  'I3-1', // NOR vs FRA — Haaland vs Mbappé
  'J3-2', // ALG vs AUT — battle for 2nd
  'K3-1', // COL vs POR — top two finale
  'L3-2', // CRO vs GHA — Croatia's 2nd-spot path
];

// Round labels that were doubles under the prior placeholder draw but
// shouldn't be under the post-draw selection. Empty after the reseed since
// every fixture is born with double_points=false; populate this if a future
// re-curation needs to flip flags back to false.
const SET_FALSE: string[] = [];

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
