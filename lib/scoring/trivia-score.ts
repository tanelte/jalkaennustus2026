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
 * - If an answer declares `conditionalOnPosition = N`, its score is gated by
 *   the answer at position N (Q5-conditional-on-Q4 trick):
 *     gate `false` → this answer scores 0 (regardless of own correctness).
 *     gate `null`  → this answer scores `null` (cannot judge the gate yet).
 *     gate `true`  → this answer scores per its own `isCorrect` value.
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
  for (const a of answers) {
    correctByPosition.set(a.position, a.isCorrect);
    conditionalByPosition.set(a.position, a.conditionalOnPosition);
  }

  const perAnswer: TriviaAnswerScore[] = ALL_POSITIONS.map((pos) => {
    const gatePosition = conditionalByPosition.get(pos) ?? null;
    if (gatePosition !== null) {
      const gate = correctByPosition.get(gatePosition) ?? null;
      if (gate === false) return { position: pos, points: 0 };
      if (gate === null) return { position: pos, points: null };
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
