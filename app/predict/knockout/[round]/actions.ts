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
  isKnockoutPredictionCode,
  isKnockoutRound,
  type KnockoutRound,
} from './constants';

export type SaveKnockoutPickError =
  | 'no_session'
  | 'no_user'
  | 'invalid_round'
  | 'invalid_prediction'
  | 'unknown_game'
  | 'wrong_round'
  | 'tbd_pair'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found'
  | 'pin_required'
  | 'pin_rate_limited';

export interface SaveKnockoutPickState {
  ok?: boolean;
  error?: SaveKnockoutPickError;
}

export async function saveKnockoutPick(
  roundRaw: string,
  gameId: string,
  prediction: string,
): Promise<SaveKnockoutPickState> {
  if (!isKnockoutRound(roundRaw)) {
    return { error: 'invalid_round' };
  }
  const round: KnockoutRound = roundRaw;

  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  if (!isKnockoutPredictionCode(prediction)) {
    return { error: 'invalid_prediction' };
  }

  const tournamentId = await getCurrentTournamentId();
  const gate = await isStageOpen(round, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'save_knockout_pick',
      outcome: 'rejected',
      reason: `stage_${gate.reason}`,
      round,
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

  // E03 PIN guard sits AFTER the stage gate and BEFORE any DB read for writes.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'save_knockout_pick',
      outcome: 'rejected',
      reason: pinGate.reason,
      round,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  const gameRows = await db
    .select({
      id: games.id,
      stage_code: games.stage_code,
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
    })
    .from(games)
    .where(and(eq(games.tournament_id, tournamentId), eq(games.id, gameId)));

  if (gameRows.length === 0) {
    return { error: 'unknown_game' };
  }
  const g = gameRows[0];
  if (g.stage_code !== round) {
    return { error: 'wrong_round' };
  }
  if (g.team_home_id === null || g.team_away_id === null) {
    return { error: 'tbd_pair' };
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
    operation: 'save_knockout_pick',
    outcome: 'ok',
    round,
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    game_id: gameId,
  });

  return { ok: true };
}
