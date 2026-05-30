import { eq } from 'drizzle-orm';
import { cache } from 'react';
import { db } from '@/lib/db';
import { tournaments } from '@/db/schema';

const DEFAULT_TOURNAMENT_CODE = 'WC2026';

export function resolveTournamentCode(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.CURRENT_TOURNAMENT_CODE || DEFAULT_TOURNAMENT_CODE;
}

export interface ResolveTournamentIdDeps {
  findTournamentIdByCode: (code: string) => Promise<string | null>;
  code?: string;
}

/**
 * Pure-ish resolver: takes a finder dep + optional override code. Throws if no row.
 * Kept separate from the cached default impl so tests can drive it without mocking
 * the drizzle module surface.
 */
export async function resolveCurrentTournamentId(
  deps: ResolveTournamentIdDeps,
): Promise<string> {
  const code = deps.code ?? resolveTournamentCode();
  const id = await deps.findTournamentIdByCode(code);
  if (!id) {
    throw new Error(
      `No tournament found with code '${code}'. Seed the tournaments table first.`,
    );
  }
  return id;
}

async function findTournamentIdByCodeDb(code: string): Promise<string | null> {
  const rows = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(eq(tournaments.code, code))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * Default app-side impl. Cached per request via React `cache` so multiple
 * Server Action callers share one db round-trip.
 */
export const getCurrentTournamentId = cache(async (): Promise<string> => {
  return resolveCurrentTournamentId({ findTournamentIdByCode: findTournamentIdByCodeDb });
});
