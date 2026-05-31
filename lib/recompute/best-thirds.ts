import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_best_thirds } from '@/db/schema';
import { BEST_THIRDS_POINTS_PER_CORRECT } from '@/lib/scoring/weights';
import { BEST_THIRDS_PICK_COUNT } from '@/lib/scoring/best-thirds-score';
import { GROUP_LETTERS } from '@/app/predict/best-thirds/constants';

const VALID_LETTERS = new Set<string>(GROUP_LETTERS);

export interface BestThirdsRow {
  id: string;
  user_id: string;
  group_letter: string;
}

export interface BestThirdsRescoreRow {
  id: string;
  points: number;
}

export type OfficialLettersValidationError =
  | 'too_many'
  | 'invalid_letter'
  | 'duplicate';

export interface ValidatedOfficialLetters {
  ok: true;
  set: ReadonlySet<string>;
}

export interface InvalidOfficialLetters {
  ok: false;
  reason: OfficialLettersValidationError;
}

/**
 * Pure: validate the operator-submitted official best-thirds set. The operator
 * may save partial progress (0..8 letters) since FIFA's tiebreaker decisions
 * trickle in during the closing matchday; the set grows incrementally and
 * scoring stabilises once it reaches 8. The player-side guard in
 * `lib/scoring/best-thirds-score.ts` is still strictly exactly-8 — it scores
 * a player's full pick set, not the operator's working set.
 */
export function validateOfficialLetters(
  letters: readonly string[],
): ValidatedOfficialLetters | InvalidOfficialLetters {
  if (letters.length > BEST_THIRDS_PICK_COUNT) {
    return { ok: false, reason: 'too_many' };
  }
  if (letters.some((l) => !VALID_LETTERS.has(l))) {
    return { ok: false, reason: 'invalid_letter' };
  }
  const set = new Set(letters);
  if (set.size !== letters.length) {
    return { ok: false, reason: 'duplicate' };
  }
  return { ok: true, set };
}

/**
 * Pure: each row scores 8 if its letter is in the official set, else 0.
 * The composite (user_id, tournament_id, group_letter) constraint guarantees
 * one row per letter per user; we simply re-score every row.
 */
export function computeBestThirdsRescoreInputs(
  rows: readonly BestThirdsRow[],
  officialSet: ReadonlySet<string>,
): BestThirdsRescoreRow[] {
  return rows.map((r) => ({
    id: r.id,
    points: officialSet.has(r.group_letter) ? BEST_THIRDS_POINTS_PER_CORRECT : 0,
  }));
}

export interface RecomputeBestThirdsResult {
  rescored: number;
  affectedUsers: number;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Orchestrator: persists the singleton's 8 official rows for this tournament
 * (delete-then-insert, idempotent) and re-scores every non-singleton player's
 * existing best-thirds rows.
 *
 * Constitution Rule 8: triggered from the operator's confirmation action.
 * Caller (the action) opens the outer tx; this helper participates in it.
 */
export async function recomputeBestThirds(
  tournamentId: string,
  systemUserId: string,
  officialLetters: readonly string[],
  tx?: DbExecutor,
): Promise<RecomputeBestThirdsResult> {
  if (!tx) {
    return db.transaction((innerTx) =>
      recomputeBestThirds(tournamentId, systemUserId, officialLetters, innerTx),
    );
  }

  const validated = validateOfficialLetters(officialLetters);
  if (!validated.ok) {
    throw new Error(`recomputeBestThirds: invalid letters (${validated.reason})`);
  }

  // 1. Re-seat the singleton's official rows (idempotent). An empty set is
  //    valid here -- the operator can clear the official letters and every
  //    player rescores to 0 below.
  await tx
    .delete(user_best_thirds)
    .where(
      and(
        eq(user_best_thirds.user_id, systemUserId),
        eq(user_best_thirds.tournament_id, tournamentId),
      ),
    );
  if (officialLetters.length > 0) {
    await tx.insert(user_best_thirds).values(
      officialLetters.map((letter) => ({
        user_id: systemUserId,
        tournament_id: tournamentId,
        group_letter: letter,
        points: BEST_THIRDS_POINTS_PER_CORRECT,
      })),
    );
  }

  // 2. Re-score every other player's rows for this tournament.
  const playerRows = await tx
    .select({
      id: user_best_thirds.id,
      user_id: user_best_thirds.user_id,
      group_letter: user_best_thirds.group_letter,
    })
    .from(user_best_thirds)
    .where(
      and(
        eq(user_best_thirds.tournament_id, tournamentId),
        ne(user_best_thirds.user_id, systemUserId),
      ),
    );

  const rescored = computeBestThirdsRescoreInputs(playerRows, validated.set);

  for (const row of rescored) {
    await tx
      .update(user_best_thirds)
      .set({ points: row.points, updated_at: new Date() })
      .where(eq(user_best_thirds.id, row.id));
  }

  const affectedUsers = new Set(playerRows.map((r) => r.user_id)).size;
  return { rescored: rescored.length, affectedUsers };
}
