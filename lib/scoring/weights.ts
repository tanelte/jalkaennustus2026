// Locked-table weights from
// specs/E01-wc2026-rewrite/research/brainstorming-session-2026-05-30-1115.md
// (Phase 3: Final Scoring Table). Group-stage match row: 5 exact / 3 winner.
// Double-points doubles the base. Per-surface stories (S07-S11) introduce
// their own weight constants alongside their scoring functions.

export const MATCH_EXACT_POINTS = 5;
export const MATCH_WINNER_POINTS = 3;
export const MATCH_MISS_POINTS = 0;
export const DOUBLE_POINTS_MULTIPLIER = 2;

// 8-best-thirds (LOCKED-1): each correct group-letter tick scores 8; wrong = 0.
// 8 correct ticks => max 64 = 6% of the total tournament point budget.
export const BEST_THIRDS_POINTS_PER_CORRECT = 8;

// Knockout match predictions (S08). Player picks `(winning side, finish-type
// mode)` per match -- exact result code (1A/1B/2A/2B) scores the round's
// exact weight; correct winning side but wrong mode scores the round's
// half-credit weight. SF half is locked at 18 (not 17.5) per the table.
export type KnockoutStageCode = 'r32' | 'r16' | 'qf' | 'sf';

export const KNOCKOUT_EXACT_POINTS_BY_STAGE: Record<KnockoutStageCode, number> = {
  r32: 8,
  r16: 14,
  qf: 22,
  sf: 35,
};

export const KNOCKOUT_WINNER_POINTS_BY_STAGE: Record<KnockoutStageCode, number> = {
  r32: 4,
  r16: 7,
  qf: 11,
  sf: 18,
};

// Final-stage medal-position picks (S09). Player picks four distinct teams
// for slots F1 (gold), F2 (silver), F3 (bronze), F4 (fourth-place). All-or-
// nothing per slot: matching team_id awards the slot's weight, otherwise 0.
// No EM-style F1↔F2 swap rule (LOCKED-5: dropped for WC). Max total = 150.
export const FINAL_SLOTS = ['F1', 'F2', 'F3', 'F4'] as const;
export type FinalSlot = (typeof FINAL_SLOTS)[number];

export const FINAL_POINTS_BY_SLOT: Record<FinalSlot, number> = {
  F1: 60,
  F2: 40,
  F3: 30,
  F4: 20,
};
