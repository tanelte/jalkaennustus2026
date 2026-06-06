'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { assertEditAllowedForUser } from '@/lib/pin/guard';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, user_games } from '@/db/schema';
import {
  GROUP_STAGE_STAGE_CODE,
  isGroupStagePredictionCode,
} from './constants';

export type SubmitGroupStagePredictionsError =
  | 'no_session'
  | 'no_user'
  | 'invalid_prediction'
  | 'unknown_game'
  | 'wrong_stage'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found'
  | 'pin_required'
  | 'pin_rate_limited';

export interface SubmitGroupStagePredictionsState {
  ok?: boolean;
  error?: SubmitGroupStagePredictionsError;
  picks_written?: number;
}

export async function submitGroupStagePredictions(
  _prev: SubmitGroupStagePredictionsState,
  formData: FormData,
): Promise<SubmitGroupStagePredictionsState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  // Parse submitted picks. Blank entries (player left a match untouched) are
  // simply skipped — partial submissions are allowed and only the filled
  // matches get persisted.
  const submitted = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('pick:')) continue;
    const gameId = key.slice('pick:'.length);
    const code = String(value);
    if (code === '') continue;
    submitted.set(gameId, code);
  }

  for (const code of submitted.values()) {
    if (!isGroupStagePredictionCode(code)) {
      return { error: 'invalid_prediction' };
    }
  }

  const tournamentId = await getCurrentTournamentId();

  // Constitution Rule 5: stage-window check happens server-side BEFORE any write.
  const gate = await isStageOpen(GROUP_STAGE_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'submit_group_stage_predictions',
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

  // Constitution Rule 5 (stage gate) ran above; E03 PIN guard sits AFTER the
  // stage gate and BEFORE any DB write.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'submit_group_stage_predictions',
      outcome: 'rejected',
      reason: pinGate.reason,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  if (submitted.size === 0) {
    log.info({
      operation: 'submit_group_stage_predictions',
      outcome: 'ok',
      user_id: userId,
      tournament_id: tournamentId,
      group_id: session.user.group_id,
      picks_written: 0,
    });
    return { ok: true, picks_written: 0 };
  }

  const submittedIds = Array.from(submitted.keys());
  const gameRows = await db
    .select({ id: games.id, stage_code: games.stage_code })
    .from(games)
    .where(and(eq(games.tournament_id, tournamentId), inArray(games.id, submittedIds)));

  if (gameRows.length !== submittedIds.length) {
    return { error: 'unknown_game' };
  }
  for (const g of gameRows) {
    if (g.stage_code !== GROUP_STAGE_STAGE_CODE) {
      return { error: 'wrong_stage' };
    }
  }

  await db.transaction(async (tx) => {
    // Idempotent: replace this user's picks for the submitted matches only.
    // Matches the player left blank stay untouched, even if a prior pick
    // exists. This lets the player edit a subset without re-confirming the
    // whole sheet.
    await tx
      .delete(user_games)
      .where(
        and(eq(user_games.user_id, userId), inArray(user_games.game_id, submittedIds)),
      );
    await tx.insert(user_games).values(
      Array.from(submitted.entries()).map(([gameId, prediction]) => ({
        user_id: userId,
        game_id: gameId,
        prediction,
      })),
    );
  });

  log.info({
    operation: 'submit_group_stage_predictions',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    picks_written: submitted.size,
  });

  return { ok: true, picks_written: submitted.size };
}
