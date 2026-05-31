/**
 * Dev-only: align the final stage window with production semantics
 * (always-open from tournament.starts_at - 30d, closes at the first final
 * kickoff). By default this is *all* the script does — the picker starts
 * with all 48 teams, matching the production "predict early, narrow later"
 * UX.
 *
 * Optional flags:
 *   --with-sf-pairings     populate SF games with real teams so the picker
 *                          narrows to the 4 semifinalists.
 *   --clear-sf-pairings    null out SF game team assignments so the picker
 *                          falls back to all 48 teams.
 *
 * Usage:
 *   pnpm tsx scripts/seed-final-dev.ts
 *   pnpm tsx scripts/seed-final-dev.ts --with-sf-pairings
 *   pnpm tsx scripts/seed-final-dev.ts --clear-sf-pairings
 *
 * Idempotent — re-running resets the same rows. Connects via
 * DATABASE_URL_ADMIN (Constitution Rule 4).
 */
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...fields }));
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const TOURNAMENT_CODE = 'WC2026';

// Two SF pairings using real WC2026 team codes from db/seed-data/wc2026.ts.
// Illustrative only — purpose is just to make the finals picker show four
// semifinalists rather than all 48 teams.
const SF_PAIRINGS: Array<{ roundLabel: string; home: string; away: string }> = [
  { roundLabel: 'SF-01', home: 'ARG', away: 'ESP' },
  { roundLabel: 'SF-02', home: 'BRA', away: 'FRA' },
];

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    logLine('error', {
      operation: 'seed_final_dev',
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

    // 1. Align the final stage window with production semantics: opens_at is
    //    the tournament-level "always open" sentinel (tournament.starts_at - 30d)
    //    so players can record medal-position picks from day one, and
    //    closes_at is the first kickoff of the final stage (3rd-place playoff
    //    or the Final itself, whichever fires first).
    const stageRes = await client.query(
      `update stages s
         set opens_at = (select starts_at - interval '30 days' from tournaments where id = s.tournament_id),
             closes_at = (
               select min(kickoff_at)
                 from games
                where tournament_id = s.tournament_id
                  and stage_code = 'final'
             )
       where s.tournament_id = $1
         and s.code = 'final'`,
      [tournamentId],
    );
    logLine('info', {
      operation: 'seed_final_dev',
      step: 'open_stage',
      rows_updated: stageRes.rowCount,
    });

    // 2. Optional SF-pairing manipulation. Default: leave SF games as-seeded
    //    so the finals picker shows all 48 teams.
    if (hasFlag('--clear-sf-pairings')) {
      const cleared = await client.query(
        `update games
           set team_home_id = null, team_away_id = null
         where tournament_id = $1 and stage_code = 'sf'`,
        [tournamentId],
      );
      logLine('info', {
        operation: 'seed_final_dev',
        step: 'clear_sf_pairings',
        rows_updated: cleared.rowCount,
      });
    } else if (hasFlag('--with-sf-pairings')) {
      let pairingsWritten = 0;
      let pairingsSkipped = 0;
      for (const slot of SF_PAIRINGS) {
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
            operation: 'seed_final_dev',
            step: 'pair_sf_teams',
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
           where tournament_id = $3 and stage_code = 'sf' and round_label = $4`,
          [homeId, awayId, tournamentId, slot.roundLabel],
        );
        if (upd.rowCount === 0) {
          pairingsSkipped += 1;
          logLine('warn', {
            operation: 'seed_final_dev',
            step: 'pair_sf_teams',
            outcome: 'game_not_found',
            round_label: slot.roundLabel,
          });
          continue;
        }
        pairingsWritten += 1;
      }
      logLine('info', {
        operation: 'seed_final_dev',
        step: 'pair_sf_teams',
        pairings_written: pairingsWritten,
        pairings_skipped: pairingsSkipped,
      });
    }

    await client.query('commit');
    logLine('info', { operation: 'seed_final_dev', outcome: 'ok' });
    return 0;
  } catch (err) {
    await client.query('rollback');
    const message = err instanceof Error ? err.message : 'unknown error';
    logLine('error', { operation: 'seed_final_dev', outcome: 'error', message });
    return 1;
  } finally {
    await client.end();
  }
}

main().then((code) => process.exit(code));
