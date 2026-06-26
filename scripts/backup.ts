import { config } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';

config({ path: '.env.local' });

// pg_dump needs the session-pooled direct connection. The transaction-pooled
// PgBouncer URL (DATABASE_URL) does not work with pg_dump (constitution rule 4).
if (!process.env.DATABASE_URL_ADMIN) {
  throw new Error(
    'DATABASE_URL_ADMIN missing — pg_dump needs the session-pooled admin connection; see .env.local.example.',
  );
}
const url: string = process.env.DATABASE_URL_ADMIN;

function main() {
  // UTC timestamp, filesystem-safe: YYYY-MM-DD-HH-MM
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const dir = path.resolve('backups');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `jalka-${stamp}.dump`);

  console.log(`Backing up to ${file} ...`);

  // --schema=public: only the app schema. Supabase's managed schemas (auth, storage,
  //   realtime, vault, extensions) are platform-provisioned and recreated by `supabase start`
  //   / the managed project, so they don't belong in our data backup.
  // -Fc: custom format — single compressed file, schema + data, restorable via pg_restore.
  const res = spawnSync('pg_dump', [url, '--schema=public', '-Fc', '-f', file], {
    stdio: 'inherit',
  });

  if (res.error) {
    if ((res.error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(
        'pg_dump not found on PATH. Install Postgres client tools:\n' +
          '  brew install libpq && brew link --force libpq',
      );
    } else {
      console.error(res.error);
    }
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(`pg_dump exited with status ${res.status}`);
    process.exit(res.status ?? 1);
  }

  const sizeMb = (statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`Done. ${file} (${sizeMb} MB)`);
  console.log(`Restore with: pg_restore --no-owner --no-privileges -d <target_url> "${file}"`);
}

main();
