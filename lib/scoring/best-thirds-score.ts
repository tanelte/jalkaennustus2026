import { BEST_THIRDS_POINTS_PER_CORRECT } from './weights';

export const BEST_THIRDS_PICK_COUNT = 8;

export interface BestThirdsScoreInput {
  playerTicks: readonly string[];
  officialBestThirds: readonly string[];
}

export interface BestThirdsScoreResult {
  points: number;
  correctCount: number;
}

/**
 * Score a player's 8-best-thirds pick against the official 8-best-thirds set.
 * Binary per tick: each correct group letter scores BEST_THIRDS_POINTS_PER_CORRECT,
 * each wrong scores 0. No partial credit. Pure function — no I/O.
 *
 * Defensive guards: both sets must contain exactly 8 unique entries. Callers gate
 * length at the action boundary; this guard catches programmer error.
 */
export function scoreBestThirds(input: BestThirdsScoreInput): BestThirdsScoreResult {
  const { playerTicks, officialBestThirds } = input;

  assertExactlyEightUnique(playerTicks, 'playerTicks');
  assertExactlyEightUnique(officialBestThirds, 'officialBestThirds');

  const officialSet = new Set(officialBestThirds);
  let correctCount = 0;
  for (const tick of playerTicks) {
    if (officialSet.has(tick)) correctCount += 1;
  }

  return {
    points: correctCount * BEST_THIRDS_POINTS_PER_CORRECT,
    correctCount,
  };
}

function assertExactlyEightUnique(values: readonly string[], label: string): void {
  if (values.length !== BEST_THIRDS_PICK_COUNT) {
    throw new Error(
      `${label} must contain exactly ${BEST_THIRDS_PICK_COUNT} entries (got ${values.length})`,
    );
  }
  if (new Set(values).size !== BEST_THIRDS_PICK_COUNT) {
    throw new Error(`${label} must contain unique entries`);
  }
}
