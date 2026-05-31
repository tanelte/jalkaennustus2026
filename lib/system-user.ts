import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/lib/db';
import { users } from '@/db/schema';

/**
 * The `tegelikud tulemused` singleton owns official tournament results.
 * Constitution Critical Rule 1: the literal username is sacred — every reader
 * goes through this helper rather than embedding the string.
 */
export interface ResolveSystemUserIdDeps {
  findSystemUserId: () => Promise<string | null>;
}

export async function resolveSystemUserId(deps: ResolveSystemUserIdDeps): Promise<string> {
  const id = await deps.findSystemUserId();
  if (!id) {
    throw new Error(
      "System user not found. The 'tegelikud tulemused' singleton must be seeded (see migration 0001).",
    );
  }
  return id;
}

async function findSystemUserIdDb(): Promise<string | null> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.is_system_user, true))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Default app-side impl. Cached per request via React `cache` so multiple
 * Server Action callers share one db round-trip.
 */
export const getSystemUserId = cache(async (): Promise<string> => {
  return resolveSystemUserId({ findSystemUserId: findSystemUserIdDb });
});
