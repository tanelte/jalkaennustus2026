'use server';

import { and, eq } from 'drizzle-orm';
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

export type SaveGroupStagePickError =
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

export interface SaveGroupStagePickState {
  ok?: boolean;
  error?: SaveGroupStagePickError;
}

export async function saveGroupStagePick(
  gameId: string,
  prediction: string,
): Promise<SaveGroupStagePickState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  if (!isGroupStagePredictionCode(prediction)) {
    return { error: 'invalid_prediction' };
  }

  const tournamentId = await getCurrentTournamentId();

  // Constitution Rule 5: stage-window check happens server-side BEFORE any write.
  const gate = await isStageOpen(GROUP_STAGE_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'save_group_stage_pick',
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

  // E03 PIN guard sits AFTER the stage gate and BEFORE any DB write.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'save_group_stage_pick',
      outcome: 'rejected',
      reason: pinGate.reason,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  const gameRows = await db
    .select({ id: games.id, stage_code: games.stage_code })
    .from(games)
    .where(and(eq(games.tournament_id, tournamentId), eq(games.id, gameId)));

  if (gameRows.length === 0) {
    return { error: 'unknown_game' };
  }
  if (gameRows[0].stage_code !== GROUP_STAGE_STAGE_CODE) {
    return { error: 'wrong_stage' };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(user_games)
      .where(and(eq(user_games.user_id, userId), eq(user_games.game_id, gameId)));
    await tx.insert(user_games).values({
      user_id: userId,
      game_id: gameId,
      prediction,
    });
  });

  log.info({
    operation: 'save_group_stage_pick',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    game_id: gameId,
  });

  return { ok: true };
}
