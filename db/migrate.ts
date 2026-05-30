/**
 * Apply SQL migrations from db/migrations in lexical order.
 *
 * Migrations are forward-only (Constitution Critical Rule 9). Each .sql file is
 * applied at most once; applied filenames are recorded in `__migrations`.
 *
 * Connects via DATABASE_URL_ADMIN (session-pooled, Critical Rule 4). Using the
 * transaction-pooled URL here breaks prepared statements.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { config } from 'dotenv';

config({ path: '.env.local' });

const MIGRATIONS_DIR = join(process.cwd(), 'db', 'migrations');

async function main() {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    throw new Error('DATABASE_URL_ADMIN is not set. See .env.local.example.');
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      create table if not exists __migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    const { rows: applied } = await client.query<{ filename: string }>(
      'select filename from __migrations',
    );
    const appliedSet = new Set(applied.map((r) => r.filename));

    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(JSON.stringify({ operation: 'migrate', outcome: 'skipped', file }));
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into __migrations (filename) values ($1)', [file]);
        await client.query('commit');
        appliedCount += 1;
        console.log(JSON.stringify({ operation: 'migrate', outcome: 'applied', file }));
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }

    console.log(
      JSON.stringify({
        operation: 'migrate',
        outcome: 'ok',
        applied: appliedCount,
        total: files.length,
      }),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      operation: 'migrate',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
});
