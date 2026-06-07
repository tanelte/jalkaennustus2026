'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { assertEditAllowedForUser } from '@/lib/pin/guard';
import { isStageOpen } from '@/lib/stages/is-stage-open';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { teams, user_teams } from '@/db/schema';
import {
  FINAL_ROUND_VALUE,
  FINAL_STAGE_CODE,
  isFinalSlot,
  type FinalSlot,
} from './constants';

export type SaveFinalSlotError =
  | 'no_session'
  | 'no_user'
  | 'invalid_slot'
  | 'unknown_team'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found'
  | 'pin_required'
  | 'pin_rate_limited';

export interface SaveFinalSlotState {
  ok?: boolean;
  error?: SaveFinalSlotError;
}

/**
 * Per-slot upsert. Pass `teamId === null` (or empty string) to clear the slot —
 * the row is deleted so the player's pick set shrinks. Partial slot fills are
 * allowed; the scoring engine only scores filled slots.
 */
export async function saveFinalSlot(
  slot: string,
  teamId: string | null,
): Promise<SaveFinalSlotState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  if (!isFinalSlot(slot)) {
    return { error: 'invalid_slot' };
  }
  const normalizedTeamId = teamId && teamId.trim() !== '' ? teamId : null;

  const tournamentId = await getCurrentTournamentId();
  const gate = await isStageOpen(FINAL_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'save_final_slot',
      outcome: 'rejected',
      reason: `stage_${gate.reason}`,
      slot,
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

  // E03 PIN guard — sits AFTER the stage gate and BEFORE any DB read for writes.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'save_final_slot',
      outcome: 'rejected',
      reason: pinGate.reason,
      slot,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  const slotValue: FinalSlot = slot;

  if (normalizedTeamId === null) {
    await db
      .delete(user_teams)
      .where(
        and(
          eq(user_teams.user_id, userId),
          eq(user_teams.tournament_id, tournamentId),
          eq(user_teams.round, FINAL_ROUND_VALUE),
          eq(user_teams.slot, slotValue),
        ),
      );
    log.info({
      operation: 'save_final_slot',
      outcome: 'cleared',
      user_id: userId,
      tournament_id: tournamentId,
      group_id: session.user.group_id,
      slot: slotValue,
    });
    revalidatePath('/');
    revalidatePath('/leaderboard');
    return { ok: true };
  }

  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.tournament_id, tournamentId), eq(teams.id, normalizedTeamId)));
  if (teamRows.length === 0) {
    return { error: 'unknown_team' };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(user_teams)
      .where(
        and(
          eq(user_teams.user_id, userId),
          eq(user_teams.tournament_id, tournamentId),
          eq(user_teams.round, FINAL_ROUND_VALUE),
          eq(user_teams.slot, slotValue),
        ),
      );
    await tx.insert(user_teams).values({
      user_id: userId,
      tournament_id: tournamentId,
      round: FINAL_ROUND_VALUE,
      slot: slotValue,
      team_id: normalizedTeamId,
    });
  });

  log.info({
    operation: 'save_final_slot',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    slot: slotValue,
  });

  revalidatePath('/');
  revalidatePath('/leaderboard');

  return { ok: true };
}
