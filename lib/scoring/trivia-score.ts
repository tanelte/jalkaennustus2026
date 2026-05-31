import { TRIVIA_POINTS_PER_CORRECT, TRIVIA_QUESTION_COUNT } from './weights';

export type TriviaPosition = 1 | 2 | 3 | 4 | 5;

export interface TriviaAnswerInput {
  position: TriviaPosition;
  isCorrect: boolean;
  // Position this answer depends on; null means scored independently.
  // Q5 sets this to 4 (Q5-conditional-on-Q4 trick). Generalised so the rule
  // moves cleanly if the seed ever changes which question is conditional.
  conditionalOnPosition: TriviaPosition | null;
}

export interface TriviaAnswerScore {
  position: TriviaPosition;
  points: number;
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
 * - Each `isCorrect` answer scores TRIVIA_POINTS_PER_CORRECT.
 * - If an answer declares `conditionalOnPosition = N`, it scores zero unless
 *   the answer at position N is itself correct. This is the Q5-conditional-on-Q4
 *   trick preserved from the legacy DNA.
 *
 * The caller is responsible for translating raw stored answers into the
 * `isCorrect` boolean per the question's `answer_shape` (integer vs text vs
 * team). This function is purely arithmetic over already-resolved truthiness.
 */
export function scoreTrivia(
  answers: readonly TriviaAnswerInput[],
): TriviaScoreResult {
  assertOneAnswerPerPosition(answers);

  const correctByPosition = new Map<TriviaPosition, boolean>();
  const conditionalByPosition = new Map<TriviaPosition, TriviaPosition | null>();
  for (const a of answers) {
    correctByPosition.set(a.position, a.isCorrect);
    conditionalByPosition.set(a.position, a.conditionalOnPosition);
  }

  const perAnswer: TriviaAnswerScore[] = ALL_POSITIONS.map((pos) => {
    const isCorrect = correctByPosition.get(pos) === true;
    const gatePosition = conditionalByPosition.get(pos) ?? null;
    const gateOpen = gatePosition === null || correctByPosition.get(gatePosition) === true;
    const points = isCorrect && gateOpen ? TRIVIA_POINTS_PER_CORRECT : 0;
    return { position: pos, points };
  });

  const totalPoints = perAnswer.reduce((sum, a) => sum + a.points, 0);
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
