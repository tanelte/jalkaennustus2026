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
  /** Player prediction rows rescored by this save (always populated on success). */
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

  const confirmedSlots = FINAL_SLOTS.filter((s) => typeof submitted[s] === 'string').length;
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

    // Each medal position is scored the moment it is confirmed — the bronze
    // game is played before the final, so F3/F4 land before F1/F2. recomputeFinals
    // re-seats the singleton's rows for the confirmed slots and rescores players
    // per-slot (positions not yet official score 0 until confirmed).
    const result = await recomputeFinals(tournamentId, systemUserId, submitted, tx);
    rescored = result.rescored;
    affectedUsers = result.affectedUsers;
  });

  log.info({
    operation: 'admin_confirm_finals',
    outcome: 'ok',
    operator_user_id: gate.userId ?? null,
    tournament_id: tournamentId,
    prior_slots: priorPicks,
    new_slots: submitted,
    confirmed_slots: confirmedSlots,
    predictions_rescored: rescored,
    affected_users: affectedUsers,
  });

  revalidatePath('/admin/finals');
  revalidatePath('/leaderboard');

  return { ok: true, rescored };
}
