'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { games, user_games } from '@/db/schema';
import {
  isKnockoutPredictionCode,
  isKnockoutRound,
  type KnockoutRound,
} from './constants';

export type SubmitKnockoutPicksError =
  | 'no_session'
  | 'no_user'
  | 'invalid_round'
  | 'invalid_prediction'
  | 'unknown_game'
  | 'wrong_round'
  | 'tbd_pair'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found';

export interface SubmitKnockoutPicksState {
  ok?: boolean;
  error?: SubmitKnockoutPicksError;
  round?: KnockoutRound;
}

export async function submitKnockoutPicks(
  _prev: SubmitKnockoutPicksState,
  formData: FormData,
): Promise<SubmitKnockoutPicksState> {
  const roundRaw = String(formData.get('round') ?? '');
  if (!isKnockoutRound(roundRaw)) {
    return { error: 'invalid_round' };
  }
  const round: KnockoutRound = roundRaw;

  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session', round };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user', round };
  }

  // Parse submitted picks: form entries `pick:<game_id>` -> prediction code.
  // Slots the player left untouched (e.g. TBD pairs) simply have no entry.
  const submitted = new Map<string, string>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('pick:')) continue;
    const gameId = key.slice('pick:'.length);
    const code = String(value);
    if (code === '') continue;
    submitted.set(gameId, code);
  }

  for (const code of submitted.values()) {
    if (!isKnockoutPredictionCode(code)) {
      return { error: 'invalid_prediction', round };
    }
  }

  const tournamentId = await getCurrentTournamentId();
  const gate = await isStageOpen(round, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'submit_knockout_picks',
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
      round,
    };
  }

  if (submitted.size === 0) {
    // Nothing to write; treat as a no-op success so the form can still report
    // "saved" to the player who came in just to look.
    log.info({
      operation: 'submit_knockout_picks',
      outcome: 'ok',
      round,
      user_id: userId,
      tournament_id: tournamentId,
      group_id: session.user.group_id,
      picks_written: 0,
    });
    return { ok: true, round };
  }

  const submittedIds = Array.from(submitted.keys());
  const gameRows = await db
    .select({
      id: games.id,
      stage_code: games.stage_code,
      team_home_id: games.team_home_id,
      team_away_id: games.team_away_id,
    })
    .from(games)
    .where(
      and(eq(games.tournament_id, tournamentId), inArray(games.id, submittedIds)),
    );

  if (gameRows.length !== submittedIds.length) {
    return { error: 'unknown_game', round };
  }
  for (const g of gameRows) {
    if (g.stage_code !== round) {
      return { error: 'wrong_round', round };
    }
    if (g.team_home_id === null || g.team_away_id === null) {
      return { error: 'tbd_pair', round };
    }
  }

  await db.transaction(async (tx) => {
    // Idempotent: replace this user's picks for this round only.
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
    operation: 'submit_knockout_picks',
    outcome: 'ok',
    round,
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    picks_written: submitted.size,
  });

  return { ok: true, round };
}
