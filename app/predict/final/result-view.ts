import { scoreFinalSlot } from '@/lib/scoring/final-score';
import { FINAL_SLOTS, type FinalSlot } from './constants';

/** Official team that finished a medal slot, plus the points the viewer earned. */
export interface FinalSlotResult {
  /** The team that actually finished in this slot. */
  officialTeamId: string;
  officialTeamName: string;
  /** The slot weight (60/40/30/20) when the viewer's pick matched, else 0. */
  points: number;
}

export type FinalResultsView = Partial<Record<FinalSlot, FinalSlotResult>>;

export interface OfficialFinalSlot {
  teamId: string;
  teamName: string;
}

/**
 * Pure: build the per-slot final result view. Each medal position is revealed as
 * soon as it becomes official — the bronze game is played before the final, so
 * F3/F4 land before F1/F2. Returns a result entry for each confirmed position;
 * returns null only when no position is official yet (nothing to show). Points
 * are recomputed live from the official picks (stays in sync with the persisted
 * `user_teams.points`), never hardcoded — the slot weight comes from
 * `scoreFinalSlot` (constitution rule 6).
 */
export function buildFinalSlotResults(
  playerPicks: Partial<Record<FinalSlot, string>>,
  officialPicks: Partial<Record<FinalSlot, OfficialFinalSlot>>,
): FinalResultsView | null {
  const out: FinalResultsView = {};
  for (const slot of FINAL_SLOTS) {
    const official = officialPicks[slot];
    if (!official) continue;
    const playerTeamId = playerPicks[slot];
    out[slot] = {
      officialTeamId: official.teamId,
      officialTeamName: official.teamName,
      points: playerTeamId
        ? scoreFinalSlot(slot, playerTeamId, official.teamId)
        : 0,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}
