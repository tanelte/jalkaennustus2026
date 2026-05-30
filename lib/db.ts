import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. See .env.local.example.');
  }
  if (!global.__pgPool) {
    global.__pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return global.__pgPool;
}

export const db = drizzle(getPool());
