import type { ResultCode } from '@/lib/scoring/types';

export const GROUP_STAGE_STAGE_CODE = 'group_matches' as const;

export const GROUP_STAGE_PREDICTION_CODES = ['1A', '1B', 'X', '2A', '2B'] as const;
export type GroupStagePredictionCode = (typeof GROUP_STAGE_PREDICTION_CODES)[number];

export function isGroupStagePredictionCode(value: string): value is GroupStagePredictionCode {
  return (GROUP_STAGE_PREDICTION_CODES as readonly string[]).includes(value);
}

// Estonian labels for the radio options on the prediction surface.
// Sourced from UX spec §8.5 sample table; labels mark home/away with the team
// name at render time so the option reads e.g. "Brasiilia võit 1-2 väravaga".
export const GROUP_STAGE_OPTION_MODE_LABELS: Record<GroupStagePredictionCode, string> = {
  '1A': 'kodumeeskonna võit 1-2 väravaga',
  '1B': 'kodumeeskonna võit 3+ väravaga',
  X: 'viik',
  '2A': 'külalismeeskonna võit 1-2 väravaga',
  '2B': 'külalismeeskonna võit 3+ väravaga',
};

// 12 groups × 6 matches each.
export const GROUP_STAGE_EXPECTED_MATCH_COUNT = 72 as const;

// 12 group letters used to bucket matches in the UI.
export const GROUP_LETTERS = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
] as const;
export type GroupLetter = (typeof GROUP_LETTERS)[number];

/**
 * Parse the leading group letter out of a `round_label` like "A1-1" (group A,
 * matchday 1, pair 1). Returns the single character; caller validates against
 * `GROUP_LETTERS` if needed.
 */
export function extractGroupLetter(roundLabel: string): string {
  return roundLabel.charAt(0);
}

// Confirms at compile time that GroupStagePredictionCode is exactly ResultCode
// — required so we can pass `prediction` straight into `scoreMatchPrediction`.
const _assertCodesMatch: GroupStagePredictionCode extends ResultCode
  ? ResultCode extends GroupStagePredictionCode
    ? true
    : false
  : false = true;
void _assertCodesMatch;
