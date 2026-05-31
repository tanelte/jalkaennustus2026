import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_teams } from '@/db/schema';
import {
  FINAL_POINTS_BY_SLOT,
  FINAL_SLOTS,
  type FinalSlot,
} from '@/lib/scoring/weights';
import { scoreFinalSlot, type FinalSlotPicks } from '@/lib/scoring/final-score';

export const FINAL_ROUND_VALUE = 'final';

export type OfficialFinalsValidationError =
  | 'missing_slot'
  | 'duplicate_team';

export interface ValidatedOfficialFinals {
  ok: true;
  slots: FinalSlotPicks;
}

export interface InvalidOfficialFinals {
  ok: false;
  reason: OfficialFinalsValidationError;
}

/**
 * Pure: validate the operator-submitted official medal set. Unlike best-thirds
 * the finals set has no defined intermediate score — either all four slots are
 * present or the operator hasn't confirmed yet. Partial saves are handled by
 * the caller (it elects not to invoke recomputeFinals).
 */
export function validateOfficialFinals(
  slots: Partial<Record<FinalSlot, string>>,
): ValidatedOfficialFinals | InvalidOfficialFinals {
  const teamIds: string[] = [];
  const complete: Partial<Record<FinalSlot, string>> = {};
  for (const slot of FINAL_SLOTS) {
    const teamId = slots[slot];
    if (typeof teamId !== 'string' || teamId.length === 0) {
      return { ok: false, reason: 'missing_slot' };
    }
    complete[slot] = teamId;
    teamIds.push(teamId);
  }
  if (new Set(teamIds).size !== FINAL_SLOTS.length) {
    return { ok: false, reason: 'duplicate_team' };
  }
  return { ok: true, slots: complete as FinalSlotPicks };
}

export interface FinalPickRow {
  id: string;
  user_id: string;
  slot: FinalSlot;
  team_id: string;
}

/**
 * Pure: group per-user rows into a `FinalSlotPicks` map, dropping users with
 * fewer than four picks (their score is undefined until they complete the set).
 */
export function groupPlayerFinalsByUser(
  rows: readonly FinalPickRow[],
): Map<string, FinalSlotPicks> {
  const byUser = new Map<string, Partial<Record<FinalSlot, string>>>();
  for (const row of rows) {
    const bucket = byUser.get(row.user_id) ?? {};
    bucket[row.slot] = row.team_id;
    byUser.set(row.user_id, bucket);
  }

  const complete = new Map<string, FinalSlotPicks>();
  for (const [userId, bucket] of byUser) {
    if (FINAL_SLOTS.every((s) => typeof bucket[s] === 'string' && bucket[s]!.length > 0)) {
      complete.set(userId, bucket as FinalSlotPicks);
    }
  }
  return complete;
}

export interface FinalRescoreRow {
  id: string;
  points: number;
}

/**
 * Pure: compute per-row points given the official slot map. Rows whose user
 * has not yet picked all four slots are scored to 0 — the leaderboard reads
 * `coalesce(points, 0)` so this collapses to "no contribution yet".
 */
export function computeFinalsRescoreInputs(
  rows: readonly FinalPickRow[],
  official: FinalSlotPicks,
): FinalRescoreRow[] {
  const completeByUser = groupPlayerFinalsByUser(rows);
  return rows.map((row) => {
    const userPicks = completeByUser.get(row.user_id);
    if (!userPicks) return { id: row.id, points: 0 };
    return {
      id: row.id,
      points: scoreFinalSlot(row.slot, userPicks[row.slot], official[row.slot]),
    };
  });
}

export interface RecomputeFinalsResult {
  rescored: number;
  affectedUsers: number;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Orchestrator: re-seats the singleton's four official rows (delete-then-insert,
 * idempotent) and rescores every non-singleton player's final-round rows for
 * this tournament. Constitution Rule 8: triggered from the operator's confirm
 * action; caller opens the outer tx, this helper participates in it.
 *
 * Caller must validate `officialSlots` first; calling with an invalid set throws.
 * `scoreFinal` is consulted via the inline per-slot equality check so the math
 * lives in lib/scoring (Rule 6) — the orchestrator only batches DB writes.
 */
export async function recomputeFinals(
  tournamentId: string,
  systemUserId: string,
  officialSlots: Partial<Record<FinalSlot, string>>,
  tx?: DbExecutor,
): Promise<RecomputeFinalsResult> {
  if (!tx) {
    return db.transaction((innerTx) =>
      recomputeFinals(tournamentId, systemUserId, officialSlots, innerTx),
    );
  }

  const validated = validateOfficialFinals(officialSlots);
  if (!validated.ok) {
    throw new Error(`recomputeFinals: invalid official slots (${validated.reason})`);
  }

  // 1. Re-seat the singleton's four official rows.
  await tx
    .delete(user_teams)
    .where(
      and(
        eq(user_teams.user_id, systemUserId),
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
      ),
    );
  await tx.insert(user_teams).values(
    FINAL_SLOTS.map((slot) => ({
      user_id: systemUserId,
      tournament_id: tournamentId,
      round: FINAL_ROUND_VALUE,
      slot,
      team_id: validated.slots[slot],
      points: FINAL_POINTS_BY_SLOT[slot],
    })),
  );

  // 2. Re-score every non-singleton player's final-round rows.
  const rawRows = await tx
    .select({
      id: user_teams.id,
      user_id: user_teams.user_id,
      slot: user_teams.slot,
      team_id: user_teams.team_id,
    })
    .from(user_teams)
    .where(
      and(
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
        ne(user_teams.user_id, systemUserId),
      ),
    );

  const playerRows: FinalPickRow[] = rawRows
    .filter((r): r is typeof r & { slot: FinalSlot } =>
      (FINAL_SLOTS as readonly string[]).includes(r.slot),
    )
    .map((r) => ({ id: r.id, user_id: r.user_id, slot: r.slot, team_id: r.team_id }));

  const rescored = computeFinalsRescoreInputs(playerRows, validated.slots);
  for (const row of rescored) {
    await tx
      .update(user_teams)
      .set({ points: row.points, updated_at: new Date() })
      .where(eq(user_teams.id, row.id));
  }

  const affectedUsers = new Set(playerRows.map((r) => r.user_id)).size;
  return { rescored: rescored.length, affectedUsers };
}
