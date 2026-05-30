/**
 * CLI: create a group with a bcrypted shared password.
 *
 * Usage:
 *   pnpm create-group --username demo --password "..."
 *   GROUP_USERNAME=demo GROUP_PASSWORD="..." pnpm create-group
 *
 * Connects via DATABASE_URL_ADMIN (session-pooled — Constitution Rule 4).
 * Idempotent: on username conflict, exits non-zero without overwriting.
 */
import { Client } from 'pg';
import bcryptjs from 'bcryptjs';
import { config } from 'dotenv';

config({ path: '.env.local' });

const BCRYPT_COST = 12;

function arg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function logLine(level: 'info' | 'warn' | 'error', fields: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), level, ...fields }),
  );
}

async function main(): Promise<number> {
  const username = (arg('--username') ?? process.env.GROUP_USERNAME ?? '').trim();
  const password = arg('--password') ?? process.env.GROUP_PASSWORD ?? '';

  if (!username || !password) {
    logLine('error', {
      operation: 'create_group',
      outcome: 'error',
      message: 'Missing --username or --password (or GROUP_USERNAME / GROUP_PASSWORD env).',
    });
    return 1;
  }
  if (password.length < 8) {
    logLine('error', {
      operation: 'create_group',
      outcome: 'error',
      message: 'Password must be at least 8 characters.',
    });
    return 1;
  }

  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    logLine('error', {
      operation: 'create_group',
      outcome: 'error',
      message: 'DATABASE_URL_ADMIN is not set. See .env.local.example.',
    });
    return 1;
  }

  const hash = await bcryptjs.hash(password, BCRYPT_COST);

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const existing = await client.query<{ id: string }>(
      'select id from groups where username = $1',
      [username],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      logLine('warn', {
        operation: 'create_group',
        outcome: 'conflict',
        username,
        message: 'Group with this username already exists; no change.',
      });
      return 2;
    }
    const inserted = await client.query<{ id: string }>(
      'insert into groups (username, password_hash) values ($1, $2) returning id',
      [username, hash],
    );
    logLine('info', {
      operation: 'create_group',
      outcome: 'ok',
      username,
      group_id: inserted.rows[0]!.id,
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
      operation: 'create_group',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
