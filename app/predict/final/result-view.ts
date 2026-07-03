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

export type FinalResultsView = Record<FinalSlot, FinalSlotResult>;

export interface OfficialFinalSlot {
  teamId: string;
  teamName: string;
}

/**
 * Pure: build the per-slot final result view. Returns null until the official
 * medal standings are complete (all four slots set) — mirrors the best-thirds
 * "results published" gate. Points are recomputed live from the official picks
 * (stays in sync with the persisted `user_teams.points`), never hardcoded — the
 * slot weight comes from `scoreFinalSlot` (constitution rule 6).
 */
export function buildFinalSlotResults(
  playerPicks: Partial<Record<FinalSlot, string>>,
  officialPicks: Partial<Record<FinalSlot, OfficialFinalSlot>>,
): FinalResultsView | null {
  const complete = FINAL_SLOTS.every((slot) => officialPicks[slot]);
  if (!complete) return null;

  const out = {} as FinalResultsView;
  for (const slot of FINAL_SLOTS) {
    const official = officialPicks[slot]!;
    const playerTeamId = playerPicks[slot];
    out[slot] = {
      officialTeamId: official.teamId,
      officialTeamName: official.teamName,
      points: playerTeamId
        ? scoreFinalSlot(slot, playerTeamId, official.teamId)
        : 0,
    };
  }
  return out;
}
