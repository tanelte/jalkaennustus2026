import type { Config } from 'drizzle-kit';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.DATABASE_URL_ADMIN;

if (!url) {
  throw new Error(
    'DATABASE_URL_ADMIN is not set. Drizzle migrations use the session-pooled admin connection; see .env.local.example.',
  );
}

export default {
  schema: './db/schema/*',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
} satisfies Config;
