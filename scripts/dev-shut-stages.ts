/**
 * Dev-only: push selected stage windows into the past so they appear in the
 * home page's "Suletud aknad" card and so the prediction surfaces render in
 * read-only mode. Companion to `dev-close-stages.ts` (which does the opposite
 * — pushes opens_at into the future to populate "Tulekul").
 *
 * Usage:
 *   pnpm tsx scripts/dev-shut-stages.ts                       # closes default set
 *   pnpm tsx scripts/dev-shut-stages.ts --codes trivia
 *   pnpm tsx scripts/dev-shut-stages.ts --codes trivia,group_matches
 *   pnpm tsx scripts/dev-shut-stages.ts --reset --codes trivia,group_matches
 *
 * Without --reset:
 *   opens_at = now() - interval '2 days'
 *   closes_at = now() - interval '1 hour'
 *
 * With --reset, restores opens_at + closes_at to the WC2026 baseline so the
 * stage opens (or stays open) again.
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

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const TOURNAMENT_CODE = 'WC2026';

const DEFAULT_CODES = ['trivia'] as const;

// Baseline opens_at/closes_at pairs to restore when --reset is passed.
// Trivia + group_matches both close at the first WC2026 kickoff per UX §6.
const BASELINE: Record<string, { opens_at: string; closes_at: string }> = {
  trivia: { opens_at: '2026-05-15T00:00:00Z', closes_at: '2026-06-11T15:00:00Z' },
  group_matches: {
    opens_at: '2026-05-15T00:00:00Z',
    closes_at: '2026-06-11T15:00:00Z',
  },
  best_thirds: {
    opens_at: '2026-06-27T18:00:00Z',
    closes_at: '2026-06-28T12:00:00Z',
  },
  r32: { opens_at: '2026-06-28T12:00:00Z', closes_at: '2026-06-30T12:00:00Z' },
  r16: { opens_at: '2026-07-04T12:00:00Z', closes_at: '2026-07-05T12:00:00Z' },
  qf: { opens_at: '2026-07-09T12:00:00Z', closes_at: '2026-07-10T12:00:00Z' },
  sf: { opens_at: '2026-07-14T12:00:00Z', closes_at: '2026-07-15T12:00:00Z' },
  final: { opens_at: '2026-07-19T12:00:00Z', closes_at: '2026-07-19T20:00:00Z' },
};

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_ADMIN (or DATABASE_URL) must be set');
  }

  const codesArg = arg('--codes');
  const reset = hasFlag('--reset');
  const codes = codesArg
    ? codesArg.split(',').map((s) => s.trim()).filter(Boolean)
    : [...DEFAULT_CODES];

  if (codes.length === 0) {
    throw new Error('No stage codes provided. Pass --codes trivia,group_matches');
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
      if (reset) {
        const baseline = BASELINE[code];
        if (!baseline) {
          logLine('warn', { msg: 'no baseline for code, skipping reset', code });
          continue;
        }
        const res = await client.query(
          `update stages
              set opens_at = $1::timestamptz,
                  closes_at = $2::timestamptz
            where tournament_id = $3
              and code = $4
            returning code, opens_at, closes_at`,
          [baseline.opens_at, baseline.closes_at, tournamentId, code],
        );
        if (res.rowCount === 0) {
          logLine('warn', { msg: 'stage row not found', code });
        } else {
          logLine('info', {
            msg: 'stage reset',
            code,
            opens_at: res.rows[0]!.opens_at,
            closes_at: res.rows[0]!.closes_at,
          });
        }
      } else {
        const res = await client.query(
          `update stages
              set opens_at = now() - interval '2 days',
                  closes_at = now() - interval '1 hour'
            where tournament_id = $1
              and code = $2
            returning code, opens_at, closes_at`,
          [tournamentId, code],
        );
        if (res.rowCount === 0) {
          logLine('warn', { msg: 'stage row not found', code });
        } else {
          logLine('info', {
            msg: 'stage shut',
            code,
            opens_at: res.rows[0]!.opens_at,
            closes_at: res.rows[0]!.closes_at,
          });
        }
      }
    }

    logLine('info', {
      msg: 'done',
      tournament: TOURNAMENT_CODE,
      mode: reset ? 'reset' : 'shut',
      codes,
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logLine('error', { msg: 'failed', error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
