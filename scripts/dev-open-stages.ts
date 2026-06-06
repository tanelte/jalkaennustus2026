/**
 * Dev-only: open every stage window NOW so all prediction surfaces are
 * editable. Useful for local end-to-end testing of group-stage, knockout,
 * best-thirds, final, and trivia in a single session — bypassing the real
 * tournament-calendar gating.
 *
 * Usage:
 *   pnpm tsx scripts/dev-open-stages.ts                       # opens default set
 *   pnpm tsx scripts/dev-open-stages.ts --codes trivia,r16    # opens only those
 *
 *   opens_at  = now() - interval '1 day'
 *   closes_at = now() + interval '30 days'
 *
 * Companion scripts: `dev-shut-stages.ts` (push windows into the past),
 * `dev-close-stages.ts` (push opens_at into the future).
 *
 * Idempotent. Connects via DATABASE_URL_ADMIN (Constitution Rule 4).
 */
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, ...fields }));
}

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const TOURNAMENT_CODE = 'WC2026';

const DEFAULT_CODES = [
  'trivia',
  'group_matches',
  'best_thirds',
  'r32',
  'r16',
  'qf',
  'sf',
  'final',
] as const;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_ADMIN (or DATABASE_URL) must be set');
  }

  const codesArg = arg('--codes');
  const codes = codesArg
    ? codesArg.split(',').map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_CODES];

  if (codes.length === 0) {
    throw new Error('No stage codes provided.');
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

    for (const code of codes) {
      const res = await client.query(
        `update stages
            set opens_at = now() - interval '1 day',
                closes_at = now() + interval '30 days'
          where tournament_id = $1
            and code = $2
          returning code, opens_at, closes_at`,
        [tournamentId, code],
      );
      if (res.rowCount === 0) {
        logLine('warn', { msg: 'stage row not found', code });
      } else {
        logLine('info', {
          msg: 'stage opened',
          code,
          opens_at: res.rows[0]!.opens_at,
          closes_at: res.rows[0]!.closes_at,
        });
      }
    }

    logLine('info', { msg: 'done', tournament: TOURNAMENT_CODE, codes });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logLine('error', { msg: 'failed', error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
