import type { KnockoutStageCode } from '@/lib/scoring/weights';

export const KNOCKOUT_ROUNDS = ['r32', 'r16', 'qf', 'sf'] as const satisfies readonly KnockoutStageCode[];

export type KnockoutRound = (typeof KNOCKOUT_ROUNDS)[number];

export function isKnockoutRound(value: string): value is KnockoutRound {
  return (KNOCKOUT_ROUNDS as readonly string[]).includes(value);
}

export const ROUND_LABELS_ET: Record<KnockoutRound, string> = {
  r32: '16-paari faas (R32)',
  r16: 'Veerandfinaali-eel (R16)',
  qf: 'Veerandfinaalid (QF)',
  sf: 'Poolfinaalid (SF)',
};

export const ROUND_EXPECTED_MATCH_COUNT: Record<KnockoutRound, number> = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
};

export const VALID_PREDICTION_CODES = ['1A', '1B', '2A', '2B'] as const;
export type KnockoutPredictionCode = (typeof VALID_PREDICTION_CODES)[number];

export function isKnockoutPredictionCode(value: string): value is KnockoutPredictionCode {
  return (VALID_PREDICTION_CODES as readonly string[]).includes(value);
}
