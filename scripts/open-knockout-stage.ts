/**
 * Open a single knockout prediction window NOW, without touching its close
 * time. Unlike `dev-open-stages.ts` (which also pushes closes_at 30 days out),
 * this keeps the round's natural first-kickoff deadline intact — it only moves
 * opens_at into the past so the stage flips from "not_yet" to "open".
 *
 * Use to let players predict a knockout round ahead of the derived schedule
 * (which opens r32 only 4h after the last group match). Production-safe.
 *
 * Idempotent + safe: updates only when opens_at > now() (i.e. the stage is
 * currently not-yet-open). Once opened, re-runs are no-ops; it never re-opens
 * an already-closed stage and never alters closes_at.
 *
 * Usage:
 *   pnpm tsx scripts/open-knockout-stage.ts              # opens r32 (default)
 *   pnpm tsx scripts/open-knockout-stage.ts --code r16   # opens r16
 *
 * Against production, point it at the session-pooled admin connection (dotenv
 * does not override an already-set env var, so the inline value wins):
 *   DATABASE_URL_ADMIN='<prod session-pooled url>' pnpm tsx scripts/open-knockout-stage.ts
 *
 * Connects via DATABASE_URL_ADMIN (Constitution Rule 4).
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
const KNOCKOUT_CODES = new Set(['r32', 'r16', 'qf', 'sf', 'final']);

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL_ADMIN (or DATABASE_URL) must be set');
  }

  const code = (arg('--code') ?? 'r32').trim();
  if (!KNOCKOUT_CODES.has(code)) {
    throw new Error(
      `Refusing to open '${code}'. --code must be one of: ${[...KNOCKOUT_CODES].join(', ')}`,
    );
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

    // Report the current state before mutating (for an auditable log trail).
    const before = await client.query<{ opens_at: Date; closes_at: Date }>(
      `select opens_at, closes_at from stages where tournament_id = $1 and code = $2`,
      [tournamentId, code],
    );
    if (before.rowCount === 0) {
      throw new Error(`Stage '${code}' not found for ${TOURNAMENT_CODE}`);
    }

    // Only open a stage that hasn't opened yet; never touch closes_at.
    const res = await client.query<{ code: string; opens_at: Date; closes_at: Date }>(
      `update stages
          set opens_at = now()
        where tournament_id = $1
          and code = $2
          and opens_at > now()
      returning code, opens_at, closes_at`,
      [tournamentId, code],
    );

    if (res.rowCount === 0) {
      logLine('info', {
        operation: 'open_knockout_stage',
        outcome: 'no_change',
        reason: 'already_open_or_past',
        code,
        opens_at: before.rows[0]!.opens_at,
        closes_at: before.rows[0]!.closes_at,
      });
    } else {
      logLine('info', {
        operation: 'open_knockout_stage',
        outcome: 'opened',
        code,
        prev_opens_at: before.rows[0]!.opens_at,
        opens_at: res.rows[0]!.opens_at,
        closes_at: res.rows[0]!.closes_at, // unchanged
      });
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logLine('error', {
    operation: 'open_knockout_stage',
    outcome: 'error',
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
