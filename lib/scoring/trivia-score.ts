import { TRIVIA_POINTS_PER_CORRECT, TRIVIA_QUESTION_COUNT } from './weights';

export type TriviaPosition = 1 | 2 | 3 | 4 | 5;

export interface TriviaAnswerInput {
  position: TriviaPosition;
  // `null` means "cannot judge yet" — either the official answer is not
  // yet known or the player has not yet answered this question.
  isCorrect: boolean | null;
  // Position this answer depends on; null means scored independently.
  // Q5 sets this to 4 (Q5-conditional-on-Q4 trick). Generalised so the rule
  // moves cleanly if the seed ever changes which question is conditional.
  conditionalOnPosition: TriviaPosition | null;
  // Proximity scoring (integer questions). When set, this answer scores by
  // closeness instead of all-or-nothing: `max(0, TRIVIA_POINTS_PER_CORRECT -
  // distance)`, where `distance` is the absolute gap |official - guess|.
  //   number → proximity score (0 gap = full marks; Infinity = junk guess = 0).
  //   null   → cannot judge yet (own official or player answer missing).
  //   absent → not proximity-scored; falls back to `isCorrect` (all-or-nothing).
  distance?: number | null;
}

export interface TriviaAnswerScore {
  position: TriviaPosition;
  // `null` means we cannot yet say how many points this answer earns —
  // either the official is missing or a conditional gate is unknown.
  points: number | null;
}

export interface TriviaScoreResult {
  perAnswer: TriviaAnswerScore[];
  totalPoints: number;
}

const ALL_POSITIONS: readonly TriviaPosition[] = [1, 2, 3, 4, 5];

/**
 * Score one player's trivia answers. Pure — no I/O.
 *
 * Rules:
 * - `isCorrect: true`  → TRIVIA_POINTS_PER_CORRECT.
 * - `isCorrect: false` → 0.
 * - `isCorrect: null`  → `null` (cannot judge yet).
 * - If an answer supplies `distance` (integer proximity questions), its own
 *   score is `max(0, TRIVIA_POINTS_PER_CORRECT - distance)` instead of the
 *   all-or-nothing `isCorrect` rule. `distance: null` → `null` (cannot judge
 *   yet); `Infinity` (junk/blank guess) floors to 0.
 * - If an answer declares `conditionalOnPosition = N`, its score is gated by
 *   the answer at position N (Q5-conditional-on-Q4 trick):
 *     gate `false` → this answer scores 0 (regardless of own correctness).
 *     gate `null`  → this answer scores `null` (cannot judge the gate yet).
 *     gate `true`  → this answer scores per its own `isCorrect`/`distance`.
 *   The gate reads the gate position's `isCorrect` (Q4 is a text question).
 *
 * Partial scoring is supported so the leaderboard can move as soon as one
 * official answer is entered — Q1 + Q2 scored even if Q3/Q4/Q5 are still
 * unknown.
 */
export function scoreTrivia(
  answers: readonly TriviaAnswerInput[],
): TriviaScoreResult {
  assertOneAnswerPerPosition(answers);

  const correctByPosition = new Map<TriviaPosition, boolean | null>();
  const conditionalByPosition = new Map<TriviaPosition, TriviaPosition | null>();
  // Only set when the input carries `distance`, so a stored `null` (cannot
  // judge yet) stays distinguishable from "not proximity-scored" (absent).
  const distanceByPosition = new Map<TriviaPosition, number | null>();
  for (const a of answers) {
    correctByPosition.set(a.position, a.isCorrect);
    conditionalByPosition.set(a.position, a.conditionalOnPosition);
    if (a.distance !== undefined) distanceByPosition.set(a.position, a.distance);
  }

  const perAnswer: TriviaAnswerScore[] = ALL_POSITIONS.map((pos) => {
    const gatePosition = conditionalByPosition.get(pos) ?? null;
    if (gatePosition !== null) {
      const gate = correctByPosition.get(gatePosition) ?? null;
      if (gate === false) return { position: pos, points: 0 };
      if (gate === null) return { position: pos, points: null };
    }
    if (distanceByPosition.has(pos)) {
      const distance = distanceByPosition.get(pos) ?? null;
      if (distance === null) return { position: pos, points: null };
      return {
        position: pos,
        points: Math.max(0, TRIVIA_POINTS_PER_CORRECT - distance),
      };
    }
    const own = correctByPosition.get(pos) ?? null;
    if (own === null) return { position: pos, points: null };
    return { position: pos, points: own ? TRIVIA_POINTS_PER_CORRECT : 0 };
  });

  const totalPoints = perAnswer.reduce((sum, a) => sum + (a.points ?? 0), 0);
  return { perAnswer, totalPoints };
}

function assertOneAnswerPerPosition(answers: readonly TriviaAnswerInput[]): void {
  if (answers.length !== TRIVIA_QUESTION_COUNT) {
    throw new Error(
      `scoreTrivia: expected exactly ${TRIVIA_QUESTION_COUNT} answers (got ${answers.length})`,
    );
  }
  const seen = new Set<TriviaPosition>();
  for (const a of answers) {
    if (!ALL_POSITIONS.includes(a.position)) {
      throw new Error(`scoreTrivia: position ${a.position} out of range 1..5`);
    }
    if (seen.has(a.position)) {
      throw new Error(`scoreTrivia: duplicate position ${a.position}`);
    }
    seen.add(a.position);
  }
}
