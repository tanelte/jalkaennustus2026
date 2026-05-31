'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { checkOperator } from '@/lib/operator/require-operator';
import { recomputeBestThirds } from '@/lib/recompute/best-thirds';
import { getSystemUserId } from '@/lib/system-user';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { user_best_thirds } from '@/db/schema';
import { BEST_THIRDS_PICK_COUNT } from '@/lib/scoring/best-thirds-score';
import { GROUP_LETTERS } from '@/app/predict/best-thirds/constants';

const VALID_LETTERS = new Set<string>(GROUP_LETTERS);

export type ConfirmBestThirdsError =
  | 'no_session'
  | 'not_operator'
  | 'too_many'
  | 'invalid_letter'
  | 'duplicate';

export interface ConfirmBestThirdsState {
  ok?: boolean;
  error?: ConfirmBestThirdsError;
  rescored?: number;
}

export async function confirmBestThirds(
  _prev: ConfirmBestThirdsState,
  formData: FormData,
): Promise<ConfirmBestThirdsState> {
  const currentUserId = await getCurrentUserId();
  const gate = await checkOperator(currentUserId);
  if (!gate.ok) {
    log.warn({
      operation: 'admin_confirm_best_thirds',
      outcome: 'rejected',
      reason: gate.reason ?? 'unknown',
      user_id: currentUserId ?? null,
    });
    return { error: gate.reason === 'no_user' ? 'no_session' : 'not_operator' };
  }

  // Operator may save partial progress (0..8 letters); FIFA's tiebreaker
  // outcomes trickle in over the closing matchday and there is no benefit
  // to gating the operator on the player picker window.
  const submitted = formData.getAll('letters').map((v) => String(v));
  if (submitted.length > BEST_THIRDS_PICK_COUNT) {
    return { error: 'too_many' };
  }
  if (submitted.some((l) => !VALID_LETTERS.has(l))) {
    return { error: 'invalid_letter' };
  }
  if (new Set(submitted).size !== submitted.length) {
    return { error: 'duplicate' };
  }

  const tournamentId = await getCurrentTournamentId();
  const systemUserId = await getSystemUserId();

  let priorLetters: string[] = [];
  const result = await db.transaction(async (tx) => {
    const priorRows = await tx
      .select({ group_letter: user_best_thirds.group_letter })
      .from(user_best_thirds)
      .where(
        and(
          eq(user_best_thirds.user_id, systemUserId),
          eq(user_best_thirds.tournament_id, tournamentId),
        ),
      )
      .orderBy(asc(user_best_thirds.group_letter));
    priorLetters = priorRows.map((r) => r.group_letter);
    return recomputeBestThirds(tournamentId, systemUserId, submitted, tx);
  });

  log.info({
    operation: 'admin_confirm_best_thirds',
    outcome: 'ok',
    operator_user_id: gate.userId ?? null,
    tournament_id: tournamentId,
    prior_letters: priorLetters,
    new_letters: submitted,
    predictions_rescored: result.rescored,
    affected_users: result.affectedUsers,
  });

  revalidatePath('/admin/best-thirds');
  revalidatePath('/leaderboard');

  return { ok: true, rescored: result.rescored };
}
