/**
 * Dev-only: push selected stage windows into the future so they appear in
 * the home page's "Tulekul" (upcoming) card. Useful when the seed has all
 * stages opened (opens_at in the past) and you want to exercise the
 * upcoming-windows surface.
 *
 * Usage:
 *   pnpm tsx scripts/dev-close-stages.ts
 *
 * Defaults: closes best_thirds, r32, r16, qf, sf, final (keeps trivia and
 * group_matches open). Sets each stage's opens_at to a fixed future date;
 * closes_at is pushed to opens_at + 24h if it would otherwise be earlier.
 *
 * Idempotent — re-running resets the same rows to the same state.
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

const TARGETS: Array<{ code: string; opensAt: string }> = [
  { code: 'best_thirds', opensAt: '2026-06-27T18:00:00Z' },
  { code: 'r32', opensAt: '2026-06-28T12:00:00Z' },
  { code: 'r16', opensAt: '2026-07-04T12:00:00Z' },
  { code: 'qf', opensAt: '2026-07-09T12:00:00Z' },
  { code: 'sf', opensAt: '2026-07-14T12:00:00Z' },
  { code: 'final', opensAt: '2026-07-19T12:00:00Z' },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_ADMIN (or DATABASE_URL) must be set');
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const t = await client.query<{ id: string }>(
      `select id from tournaments where code = $1 limit 1`,
      [TOURNAMENT_CODE],
    );
    const tournamentId = t.rows[0]?.id;
    if (!tournamentId) {
      throw new Error(`Tournament ${TOURNAMENT_CODE} not found — run pnpm db:seed first`);
    }

    for (const target of TARGETS) {
      const res = await client.query(
        `update stages
            set opens_at = $1::timestamptz,
                closes_at = greatest(closes_at, $1::timestamptz + interval '24 hours')
          where tournament_id = $2
            and code = $3
          returning code, opens_at, closes_at`,
        [target.opensAt, tournamentId, target.code],
      );
      if (res.rowCount === 0) {
        logLine('warn', { msg: 'stage row not found', code: target.code });
      } else {
        logLine('info', {
          msg: 'stage pushed to future',
          code: target.code,
          opens_at: res.rows[0]!.opens_at,
          closes_at: res.rows[0]!.closes_at,
        });
      }
    }

    logLine('info', { msg: 'done', tournament: TOURNAMENT_CODE, closed: TARGETS.length });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logLine('error', { msg: 'failed', error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
