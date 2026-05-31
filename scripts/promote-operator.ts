/**
 * CLI: flip is_operator=true on a user, so they can reach /admin.
 *
 * Usage:
 *   tsx scripts/promote-operator.ts --username liisa
 *   tsx scripts/promote-operator.ts --username liisa --revoke
 *
 * Connects via DATABASE_URL_ADMIN (session-pooled — Constitution Rule 4).
 * Idempotent: re-running with the same flag is a no-op.
 */
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, ...fields }),
  );
}

async function main(): Promise<number> {
  const username = (arg('--username') ?? '').trim();
  const revoke = hasFlag('--revoke');
  const desired = !revoke;

  if (!username) {
    logLine('error', {
      operation: 'promote_operator',
      outcome: 'error',
      message: 'Missing --username.',
    });
    return 1;
  }

  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    logLine('error', {
      operation: 'promote_operator',
      outcome: 'error',
      message: 'DATABASE_URL_ADMIN is not set. See .env.local.example.',
    });
    return 1;
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query<{ id: string; is_operator: boolean }>(
      'update users set is_operator = $2 where username = $1 returning id, is_operator',
      [username, desired],
    );
    if (result.rowCount === 0) {
      logLine('warn', {
        operation: 'promote_operator',
        outcome: 'not_found',
        username,
      });
      return 2;
    }
    logLine('info', {
      operation: 'promote_operator',
      outcome: 'ok',
      username,
      user_id: result.rows[0]!.id,
      is_operator: result.rows[0]!.is_operator,
    });
    return 0;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    logLine('error', {
      operation: 'promote_operator',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
