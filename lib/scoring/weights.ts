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
