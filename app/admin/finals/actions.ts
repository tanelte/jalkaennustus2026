'use server';

import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { checkOperator } from '@/lib/operator/require-operator';
import {
  FINAL_ROUND_VALUE,
  recomputeFinals,
} from '@/lib/recompute/final-score';
import { getSystemUserId } from '@/lib/system-user';
import { getCurrentTournamentId } from '@/lib/tournaments/current';
import { teams, user_teams } from '@/db/schema';
import {
  FINAL_SLOTS,
  FORM_FIELD_PREFIX,
  type FinalSlot,
} from '@/app/predict/final/constants';

export type ConfirmFinalsError =
  | 'no_session'
  | 'not_operator'
  | 'duplicate_team'
  | 'unknown_team';

export interface ConfirmFinalsState {
  ok?: boolean;
  error?: ConfirmFinalsError;
  rescored?: number;
}

export async function confirmFinals(
  _prev: ConfirmFinalsState,
  formData: FormData,
): Promise<ConfirmFinalsState> {
  const currentUserId = await getCurrentUserId();
  const gate = await checkOperator(currentUserId);
  if (!gate.ok) {
    log.warn({
      operation: 'admin_confirm_finals',
      outcome: 'rejected',
      reason: gate.reason ?? 'unknown',
      user_id: currentUserId ?? null,
    });
    return { error: gate.reason === 'no_user' ? 'no_session' : 'not_operator' };
  }

  const submitted: Partial<Record<FinalSlot, string>> = {};
  const filledTeamIds: string[] = [];
  for (const slot of FINAL_SLOTS) {
    const value = String(formData.get(`${FORM_FIELD_PREFIX}${slot}`) ?? '').trim();
    if (value === '') continue;
    submitted[slot] = value;
    filledTeamIds.push(value);
  }

  if (new Set(filledTeamIds).size !== filledTeamIds.length) {
    return { error: 'duplicate_team' };
  }

  const tournamentId = await getCurrentTournamentId();
  const systemUserId = await getSystemUserId();

  if (filledTeamIds.length > 0) {
    const teamRows = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.tournament_id, tournamentId), inArray(teams.id, filledTeamIds)));
    if (teamRows.length !== filledTeamIds.length) {
      return { error: 'unknown_team' };
    }
  }

  const isComplete = FINAL_SLOTS.every((s) => typeof submitted[s] === 'string');
  let priorPicks: Partial<Record<FinalSlot, string>> = {};
  let rescored = 0;
  let affectedUsers = 0;

  await db.transaction(async (tx) => {
    const priorRows = await tx
      .select({ slot: user_teams.slot, team_id: user_teams.team_id })
      .from(user_teams)
      .where(
        and(
          eq(user_teams.user_id, systemUserId),
          eq(user_teams.tournament_id, tournamentId),
          eq(user_teams.round, FINAL_ROUND_VALUE),
        ),
      );
    for (const row of priorRows) {
      if ((FINAL_SLOTS as readonly string[]).includes(row.slot)) {
        priorPicks[row.slot as FinalSlot] = row.team_id;
      }
    }

    if (isComplete) {
      const result = await recomputeFinals(tournamentId, systemUserId, submitted, tx);
      rescored = result.rescored;
      affectedUsers = result.affectedUsers;
      return;
    }

    // Partial save: re-seat singleton's rows (whatever is filled) so the admin
    // surface can pick up where it left off. Players are NOT rescored: the
    // finals score is undefined until all four slots are official.
    await tx
      .delete(user_teams)
      .where(
        and(
          eq(user_teams.user_id, systemUserId),
          eq(user_teams.tournament_id, tournamentId),
          eq(user_teams.round, FINAL_ROUND_VALUE),
        ),
      );
    const partialRows = FINAL_SLOTS.filter((s) => submitted[s]).map((slot) => ({
      user_id: systemUserId,
      tournament_id: tournamentId,
      round: FINAL_ROUND_VALUE,
      slot,
      team_id: submitted[slot]!,
      points: 0,
    }));
    if (partialRows.length > 0) {
      await tx.insert(user_teams).values(partialRows);
    }
  });

  log.info({
    operation: 'admin_confirm_finals',
    outcome: 'ok',
    operator_user_id: gate.userId ?? null,
    tournament_id: tournamentId,
    prior_slots: priorPicks,
    new_slots: submitted,
    complete: isComplete,
    predictions_rescored: rescored,
    affected_users: affectedUsers,
  });

  revalidatePath('/admin/finals');
  revalidatePath('/leaderboard');

  return { ok: true, rescored: isComplete ? rescored : undefined };
}
