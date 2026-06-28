import { BEST_THIRDS_POINTS_PER_CORRECT } from '@/lib/scoring/weights';
import { GROUP_LETTERS, REQUIRED_PICKS } from './constants';

/**
 * Per-letter outcome once the official best-thirds set is in:
 * - `correct`  — the player picked this letter and it is official (scores 8)
 * - `wrong`    — the player picked this letter but it is not official (scores 0)
 * - `missed`   — official letter the player did NOT pick (a right answer missed)
 * - `neutral`  — neither picked nor official
 */
export type BestThirdsLetterStatus = 'correct' | 'wrong' | 'missed' | 'neutral';

export interface BestThirdsLetterView {
  letter: string;
  picked: boolean;
  official: boolean;
  status: BestThirdsLetterStatus;
  /** 8 for a correct pick, 0 otherwise. */
  points: number;
}

export interface BestThirdsResultView {
  /** One entry per group letter (A–L), in canonical GROUP_LETTERS order. */
  letters: BestThirdsLetterView[];
  /** The official correct letters, in canonical order. */
  officialLetters: string[];
  totalPoints: number;
  /** 8 correct × 8 points = 64. */
  maxPoints: number;
  correctCount: number;
}

/**
 * Pure: build the post-results view model for the best-thirds surface. Scoring
 * is derived live from the official set (mirrors the group-stage surface, which
 * recomputes from the actual result code rather than trusting persisted points).
 *
 * Each correct pick scores BEST_THIRDS_POINTS_PER_CORRECT — the canonical weight,
 * never hardcoded (constitution rule 6).
 */
export function buildBestThirdsResultView(
  picks: readonly string[],
  officialLetters: readonly string[],
): BestThirdsResultView {
  const pickedSet = new Set(picks);
  const officialSet = new Set(officialLetters);
  // An empty official set means results are not in yet: no answer exists to be
  // wrong against, so every letter is neutral (callers also gate on non-empty).
  const resultsIn = officialSet.size > 0;

  let correctCount = 0;
  const letters: BestThirdsLetterView[] = GROUP_LETTERS.map((letter) => {
    const picked = pickedSet.has(letter);
    const official = officialSet.has(letter);

    let status: BestThirdsLetterStatus;
    if (!resultsIn) status = 'neutral';
    else if (picked && official) status = 'correct';
    else if (picked && !official) status = 'wrong';
    else if (!picked && official) status = 'missed';
    else status = 'neutral';

    if (status === 'correct') correctCount += 1;

    return {
      letter,
      picked,
      official,
      status,
      points: status === 'correct' ? BEST_THIRDS_POINTS_PER_CORRECT : 0,
    };
  });

  return {
    letters,
    officialLetters: GROUP_LETTERS.filter((l) => officialSet.has(l)),
    totalPoints: correctCount * BEST_THIRDS_POINTS_PER_CORRECT,
    maxPoints: REQUIRED_PICKS * BEST_THIRDS_POINTS_PER_CORRECT,
    correctCount,
  };
}
