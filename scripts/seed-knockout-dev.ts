/**
 * Dev-only: open the four knockout stage windows and populate a handful of
 * bracket games with real teams so the /predict/knockout/[round] surfaces
 * can be exercised manually.
 *
 * Usage:
 *   pnpm tsx scripts/seed-knockout-dev.ts
 *
 * Idempotent — re-running just resets the same rows to the same state.
 * Connects via DATABASE_URL_ADMIN (Constitution Rule 4).
 */
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...fields }));
}

const TOURNAMENT_CODE = 'WC2026';

// Round → list of (round_label, home_team_code, away_team_code) pairings.
// Real WC2026 team codes from db/seed-data/wc2026.ts. Brackets are illustrative,
// not the actual bracket draw — purpose is just to give the dev a non-TBD set
// of slots to pick in.
const PAIRINGS: Array<{
  round: 'r32' | 'r16' | 'qf' | 'sf';
  slots: Array<{ roundLabel: string; home: string; away: string }>;
}> = [
  {
    round: 'r32',
    slots: [
      { roundLabel: 'R32-01', home: 'USA', away: 'JAM' },
      { roundLabel: 'R32-02', home: 'ARG', away: 'GHA' },
      { roundLabel: 'R32-03', home: 'BRA', away: 'EGY' },
      { roundLabel: 'R32-04', home: 'FRA', away: 'AUS' },
      { roundLabel: 'R32-05', home: 'ESP', away: 'CRC' },
      { roundLabel: 'R32-06', home: 'GER', away: 'PAN' },
      { roundLabel: 'R32-07', home: 'POR', away: 'KSA' },
      { roundLabel: 'R32-08', home: 'NED', away: 'QAT' },
    ],
  },
  {
    round: 'r16',
    slots: [
      { roundLabel: 'R16-01', home: 'USA', away: 'ARG' },
      { roundLabel: 'R16-02', home: 'BRA', away: 'FRA' },
      { roundLabel: 'R16-03', home: 'ESP', away: 'GER' },
      { roundLabel: 'R16-04', home: 'POR', away: 'NED' },
    ],
  },
  {
    round: 'qf',
    slots: [
      { roundLabel: 'QF-01', home: 'ARG', away: 'BRA' },
      { roundLabel: 'QF-02', home: 'ESP', away: 'POR' },
    ],
  },
  {
    round: 'sf',
    slots: [{ roundLabel: 'SF-01', home: 'ARG', away: 'ESP' }],
  },
];

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    logLine('error', {
      operation: 'seed_knockout_dev',
      outcome: 'error',
      message: 'DATABASE_URL_ADMIN is not set. See .env.local.example.',
    });
    return 1;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('begin');

    const tRow = await client.query<{ id: string }>(
      'select id from tournaments where code = $1',
      [TOURNAMENT_CODE],
    );
    const tournamentId = tRow.rows[0]?.id;
    if (!tournamentId) {
      throw new Error(`No tournament '${TOURNAMENT_CODE}' — run pnpm db:seed first.`);
    }

    // 1. Open all four knockout stage windows: opens_at = now() - 1h,
    //    closes_at = now() + 30d. Idempotent — same row, same shape.
    const stageRes = await client.query(
      `update stages
         set opens_at = now() - interval '1 hour',
             closes_at = now() + interval '30 days'
       where tournament_id = $1
         and code = any($2::text[])`,
      [tournamentId, ['r32', 'r16', 'qf', 'sf']],
    );
    logLine('info', {
      operation: 'seed_knockout_dev',
      step: 'open_stages',
      rows_updated: stageRes.rowCount,
    });

    // 2. Populate bracket pairings for each round.
    let pairingsWritten = 0;
    let pairingsSkipped = 0;
    for (const { round, slots } of PAIRINGS) {
      for (const slot of slots) {
        const homeRow = await client.query<{ id: string }>(
          'select id from teams where tournament_id = $1 and code = $2',
          [tournamentId, slot.home],
        );
        const awayRow = await client.query<{ id: string }>(
          'select id from teams where tournament_id = $1 and code = $2',
          [tournamentId, slot.away],
        );
        const homeId = homeRow.rows[0]?.id ?? null;
        const awayId = awayRow.rows[0]?.id ?? null;
        if (!homeId || !awayId) {
          pairingsSkipped += 1;
          logLine('warn', {
            operation: 'seed_knockout_dev',
            step: 'pair_teams',
            outcome: 'team_not_found',
            round_label: slot.roundLabel,
            home: slot.home,
            away: slot.away,
          });
          continue;
        }
        const upd = await client.query(
          `update games
             set team_home_id = $1, team_away_id = $2
           where tournament_id = $3 and stage_code = $4 and round_label = $5`,
          [homeId, awayId, tournamentId, round, slot.roundLabel],
        );
        if (upd.rowCount === 0) {
          pairingsSkipped += 1;
          logLine('warn', {
            operation: 'seed_knockout_dev',
            step: 'pair_teams',
            outcome: 'game_not_found',
            round,
            round_label: slot.roundLabel,
          });
          continue;
        }
        pairingsWritten += 1;
      }
    }
    logLine('info', {
      operation: 'seed_knockout_dev',
      step: 'pair_teams',
      pairings_written: pairingsWritten,
      pairings_skipped: pairingsSkipped,
    });

    await client.query('commit');
    logLine('info', {
      operation: 'seed_knockout_dev',
      outcome: 'ok',
      tournament_id: tournamentId,
    });
    return 0;
  } catch (err) {
    await client.query('rollback');
    const message = err instanceof Error ? err.message : 'unknown error';
    logLine('error', {
      operation: 'seed_knockout_dev',
      outcome: 'error',
      message,
    });
    return 1;
  } finally {
    await client.end();
  }
}

main().then((code) => process.exit(code));
