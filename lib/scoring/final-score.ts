import { FINAL_POINTS_BY_SLOT, FINAL_SLOTS, type FinalSlot } from './weights';

export type FinalSlotPicks = Record<FinalSlot, string>;

export interface FinalScoreInput {
  playerSlots: FinalSlotPicks;
  officialSlots: FinalSlotPicks;
}

export interface FinalScoreResult {
  points: number;
  correctSlots: FinalSlot[];
}

/**
 * Score a player's final-stage F1/F2/F3/F4 picks against the official medal
 * standings. Per-slot binary: matching team_id awards FINAL_POINTS_BY_SLOT[slot],
 * else 0. No partial credit, no EM swap rule (LOCKED-5 dropped for WC).
 * Pure function — no I/O.
 *
 * Defensive guards: both sides must contain all four slots and four distinct
 * team ids. Callers validate at the action boundary; these guards catch
 * programmer error.
 */
export function scoreFinal(input: FinalScoreInput): FinalScoreResult {
  const { playerSlots, officialSlots } = input;

  // Players may tactically place the same team in multiple medal slots, so we
  // only require completeness — not distinctness — on `playerSlots`. The
  // official set must still be four distinct teams (one team cannot finish in
  // two medal positions).
  assertAllSlotsFilled(playerSlots, 'playerSlots');
  assertAllSlotsFilled(officialSlots, 'officialSlots');
  assertFourDistinctTeams(officialSlots, 'officialSlots');

  const correctSlots: FinalSlot[] = [];
  let points = 0;
  for (const slot of FINAL_SLOTS) {
    if (playerSlots[slot] === officialSlots[slot]) {
      correctSlots.push(slot);
      points += FINAL_POINTS_BY_SLOT[slot];
    }
  }

  return { points, correctSlots };
}

/**
 * Per-slot variant used by the recompute path, which writes points row-by-row
 * (one row = one slot) for batching. Constitution Rule 6: keep the equality
 * check in lib/scoring/ rather than inlining in the orchestrator.
 */
export function scoreFinalSlot(
  slot: FinalSlot,
  playerTeamId: string,
  officialTeamId: string,
): number {
  return playerTeamId === officialTeamId ? FINAL_POINTS_BY_SLOT[slot] : 0;
}

function assertAllSlotsFilled(slots: FinalSlotPicks, label: string): void {
  for (const slot of FINAL_SLOTS) {
    const teamId = slots[slot];
    if (typeof teamId !== 'string' || teamId.length === 0) {
      throw new Error(`${label} must include a team for slot ${slot}`);
    }
  }
}

function assertFourDistinctTeams(slots: FinalSlotPicks, label: string): void {
  const teamIds = FINAL_SLOTS.map((slot) => slots[slot]);
  if (new Set(teamIds).size !== FINAL_SLOTS.length) {
    throw new Error(`${label} must reference four distinct teams`);
  }
}
