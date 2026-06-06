'use server';

import { and, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { assertEditAllowedForUser } from '@/lib/pin/guard';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { user_best_thirds } from '@/db/schema';
import { BEST_THIRDS_STAGE_CODE, GROUP_LETTERS } from './constants';

const VALID_LETTERS = new Set<string>(GROUP_LETTERS);

export type ToggleBestThirdsLetterError =
  | 'invalid_letter'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found'
  | 'no_user'
  | 'no_session'
  | 'pin_required'
  | 'pin_rate_limited';

export interface ToggleBestThirdsLetterState {
  ok?: boolean;
  error?: ToggleBestThirdsLetterError;
}

/**
 * Per-letter toggle. `selected=true` inserts (idempotent), `selected=false`
 * deletes. The UI may cap the visible selection at 8 for ergonomics, but the
 * server itself accepts any subset of A–L — partial saves are fine; scoring
 * applies to whatever rows exist at stage close.
 */
export async function toggleBestThirdsLetter(
  letter: string,
  selected: boolean,
): Promise<ToggleBestThirdsLetterState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  if (!VALID_LETTERS.has(letter)) {
    return { error: 'invalid_letter' };
  }

  const tournamentId = await getCurrentTournamentId();
  const gate = await isStageOpen(BEST_THIRDS_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'toggle_best_thirds_letter',
      outcome: 'rejected',
      reason: `stage_${gate.reason}`,
      user_id: userId,
      tournament_id: tournamentId,
    });
    return {
      error:
        gate.reason === 'closed'
          ? 'stage_closed'
          : gate.reason === 'not_yet'
          ? 'stage_not_yet'
          : 'stage_not_found',
    };
  }

  // E03 PIN guard — sits AFTER the stage gate and BEFORE any DB write.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'toggle_best_thirds_letter',
      outcome: 'rejected',
      reason: pinGate.reason,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  if (selected) {
    await db
      .insert(user_best_thirds)
      .values({
        user_id: userId,
        tournament_id: tournamentId,
        group_letter: letter,
      })
      .onConflictDoNothing();
  } else {
    await db
      .delete(user_best_thirds)
      .where(
        and(
          eq(user_best_thirds.user_id, userId),
          eq(user_best_thirds.tournament_id, tournamentId),
          eq(user_best_thirds.group_letter, letter),
        ),
      );
  }

  log.info({
    operation: 'toggle_best_thirds_letter',
    outcome: selected ? 'added' : 'removed',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    group_letter: letter,
  });

  return { ok: true };
}
