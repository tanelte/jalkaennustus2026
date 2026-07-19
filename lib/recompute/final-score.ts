import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { user_teams } from '@/db/schema';
import {
  FINAL_POINTS_BY_SLOT,
  FINAL_SLOTS,
  type FinalSlot,
} from '@/lib/scoring/weights';
import { scoreFinalSlot } from '@/lib/scoring/final-score';

export const FINAL_ROUND_VALUE = 'final';

/** Official medal set — may be partial: positions become official at different
 * times (F3/F4 at the 3rd-place game, F1/F2 after the final). */
export type OfficialFinalPicks = Partial<Record<FinalSlot, string>>;

export type OfficialFinalsValidationError = 'duplicate_team';

export interface ValidatedOfficialFinals {
  ok: true;
  slots: OfficialFinalPicks;
}

export interface InvalidOfficialFinals {
  ok: false;
  reason: OfficialFinalsValidationError;
}

/**
 * Pure: validate the operator-submitted official medal set. The set may be
 * partial — each medal position is scored independently as soon as it is
 * confirmed (bronze/fourth after the 3rd-place game, gold/silver after the
 * final), so missing slots are allowed. The only invariant is that the *filled*
 * slots reference distinct teams (one team cannot finish in two positions).
 */
export function validateOfficialFinals(
  slots: OfficialFinalPicks,
): ValidatedOfficialFinals | InvalidOfficialFinals {
  const teamIds: string[] = [];
  const filled: OfficialFinalPicks = {};
  for (const slot of FINAL_SLOTS) {
    const teamId = slots[slot];
    if (typeof teamId !== 'string' || teamId.length === 0) continue;
    filled[slot] = teamId;
    teamIds.push(teamId);
  }
  if (new Set(teamIds).size !== teamIds.length) {
    return { ok: false, reason: 'duplicate_team' };
  }
  return { ok: true, slots: filled };
}

export interface FinalPickRow {
  id: string;
  user_id: string;
  slot: FinalSlot;
  team_id: string;
}

export interface FinalRescoreRow {
  id: string;
  points: number;
}

/**
 * Pure: compute per-row points against the (possibly partial) official map.
 * Each row is scored independently on its own slot (per-slot independence — a
 * player earns a position's weight whenever their pick matches, regardless of
 * how many other positions they filled). Rows whose slot is not yet official
 * score 0 for now and are rescored once the operator confirms that position.
 */
export function computeFinalsRescoreInputs(
  rows: readonly FinalPickRow[],
  official: OfficialFinalPicks,
): FinalRescoreRow[] {
  return rows.map((row) => {
    const officialTeamId = official[row.slot];
    return {
      id: row.id,
      points: officialTeamId
        ? scoreFinalSlot(row.slot, row.team_id, officialTeamId)
        : 0,
    };
  });
}

export interface RecomputeFinalsResult {
  rescored: number;
  affectedUsers: number;
}

type DbExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Orchestrator: re-seats the singleton's official rows (delete-then-insert,
 * idempotent — one row per confirmed slot) and rescores every non-singleton
 * player's final-round rows for this tournament. Constitution Rule 8: triggered
 * from the operator's confirm action; caller opens the outer tx, this helper
 * participates in it.
 *
 * `officialSlots` may be partial (e.g. only F3/F4 once the bronze game is
 * played). Caller must validate first only in the sense that an invalid set
 * (duplicate team) throws here. The per-slot equality check lives in
 * lib/scoring (`scoreFinalSlot`, Rule 6) — the orchestrator only batches writes.
 */
export async function recomputeFinals(
  tournamentId: string,
  systemUserId: string,
  officialSlots: OfficialFinalPicks,
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

  // 1. Re-seat the singleton's official rows — one row per confirmed slot.
  await tx
    .delete(user_teams)
    .where(
      and(
        eq(user_teams.user_id, systemUserId),
        eq(user_teams.tournament_id, tournamentId),
        eq(user_teams.round, FINAL_ROUND_VALUE),
      ),
    );
  const officialRows = FINAL_SLOTS.filter((slot) => validated.slots[slot]).map(
    (slot) => ({
      user_id: systemUserId,
      tournament_id: tournamentId,
      round: FINAL_ROUND_VALUE,
      slot,
      team_id: validated.slots[slot]!,
      points: FINAL_POINTS_BY_SLOT[slot],
    }),
  );
  if (officialRows.length > 0) {
    await tx.insert(user_teams).values(officialRows);
  }

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
