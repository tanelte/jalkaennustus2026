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
import { BEST_THIRDS_STAGE_CODE, GROUP_LETTERS, REQUIRED_PICKS } from './constants';

const VALID_LETTERS = new Set<string>(GROUP_LETTERS);

export interface SubmitBestThirdsState {
  error?:
    | 'invalid_count'
    | 'invalid_letter'
    | 'duplicate'
    | 'stage_closed'
    | 'stage_not_yet'
    | 'stage_not_found'
    | 'no_user'
    | 'no_session'
    | 'pin_required'
    | 'pin_rate_limited';
  ok?: boolean;
}

export async function submitBestThirds(
  _prev: SubmitBestThirdsState,
  formData: FormData,
): Promise<SubmitBestThirdsState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  const submitted = formData.getAll('letters').map((v) => String(v));

  if (submitted.length !== REQUIRED_PICKS) {
    return { error: 'invalid_count' };
  }
  if (submitted.some((l) => !VALID_LETTERS.has(l))) {
    return { error: 'invalid_letter' };
  }
  if (new Set(submitted).size !== REQUIRED_PICKS) {
    return { error: 'duplicate' };
  }

  const tournamentId = await getCurrentTournamentId();
  const gate = await isStageOpen(BEST_THIRDS_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'submit_best_thirds',
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

  // E03 PIN guard — sits AFTER the stage gate and BEFORE the DB write.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'submit_best_thirds',
      outcome: 'rejected',
      reason: pinGate.reason,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(user_best_thirds)
      .where(
        and(
          eq(user_best_thirds.user_id, userId),
          eq(user_best_thirds.tournament_id, tournamentId),
        ),
      );
    await tx.insert(user_best_thirds).values(
      submitted.map((letter) => ({
        user_id: userId,
        tournament_id: tournamentId,
        group_letter: letter,
      })),
    );
  });

  log.info({
    operation: 'submit_best_thirds',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    picks_written: submitted.length,
  });

  return { ok: true };
}
