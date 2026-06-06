'use server';

import { and, eq, inArray } from 'drizzle-orm';
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
  FINAL_SLOTS,
  FINAL_STAGE_CODE,
  FORM_FIELD_PREFIX,
  type FinalSlot,
} from './constants';

export type SubmitFinalPicksError =
  | 'no_session'
  | 'no_user'
  | 'missing_slot'
  | 'unknown_team'
  | 'stage_closed'
  | 'stage_not_yet'
  | 'stage_not_found'
  | 'pin_required'
  | 'pin_rate_limited';

export interface SubmitFinalPicksState {
  ok?: boolean;
  error?: SubmitFinalPicksError;
}

export async function submitFinalPicks(
  _prev: SubmitFinalPicksState,
  formData: FormData,
): Promise<SubmitFinalPicksState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    return { error: 'no_user' };
  }

  const picks: Partial<Record<FinalSlot, string>> = {};
  for (const slot of FINAL_SLOTS) {
    const value = String(formData.get(`${FORM_FIELD_PREFIX}${slot}`) ?? '').trim();
    if (value === '') {
      return { error: 'missing_slot' };
    }
    picks[slot] = value;
  }

  // Players may tactically pick the same team for multiple medal slots.
  const teamIds = FINAL_SLOTS.map((s) => picks[s]!);

  const tournamentId = await getCurrentTournamentId();
  const gate = await isStageOpen(FINAL_STAGE_CODE, tournamentId);
  if (!gate.open) {
    log.warn({
      operation: 'submit_final_picks',
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

  // E03 PIN guard — sits AFTER the stage gate and BEFORE any DB read for writes.
  const pinGate = await assertEditAllowedForUser({
    groupId: session.user.group_id,
    userId,
  });
  if (!pinGate.ok) {
    log.warn({
      operation: 'submit_final_picks',
      outcome: 'rejected',
      reason: pinGate.reason,
      user_id: userId,
      group_id: session.user.group_id,
      tournament_id: tournamentId,
    });
    return { error: pinGate.reason };
  }

  // Verify every chosen team belongs to this tournament before writing.
  // Players may repeat a team across slots, so check against the distinct set.
  const distinctTeamIds = Array.from(new Set(teamIds));
  const teamRows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.tournament_id, tournamentId), inArray(teams.id, distinctTeamIds)));
  if (teamRows.length !== distinctTeamIds.length) {
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
        ),
      );
    await tx.insert(user_teams).values(
      FINAL_SLOTS.map((slot) => ({
        user_id: userId,
        tournament_id: tournamentId,
        round: FINAL_ROUND_VALUE,
        slot,
        team_id: picks[slot]!,
      })),
    );
  });

  log.info({
    operation: 'submit_final_picks',
    outcome: 'ok',
    user_id: userId,
    tournament_id: tournamentId,
    group_id: session.user.group_id,
    picks_written: FINAL_SLOTS.length,
  });

  return { ok: true };
}
