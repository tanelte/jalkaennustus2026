import { FINAL_SLOTS, type FinalSlot } from '@/lib/scoring/weights';

export { FINAL_SLOTS };
export type { FinalSlot };

export const FINAL_STAGE_CODE = 'final';
export const FINAL_ROUND_VALUE = 'final';

export const FINAL_SLOT_LABELS_ET: Record<FinalSlot, string> = {
  F1: 'F1 — kuld (1. koht)',
  F2: 'F2 — hõbe (2. koht)',
  F3: 'F3 — pronks (3. koht)',
  F4: 'F4 — neljas koht',
};

export const FORM_FIELD_PREFIX = 'final_slot_';

export function isFinalSlot(value: string): value is FinalSlot {
  return (FINAL_SLOTS as readonly string[]).includes(value);
}
