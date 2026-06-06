'use server';

import { revalidatePath } from 'next/cache';

import { log } from '@/lib/log';
import { consumeResetToken } from '@/lib/pin/recovery';

export type SetNewPinFromTokenError = 'invalid_or_expired' | 'pin_mismatch';

export interface SetNewPinFromTokenState {
  ok?: boolean;
  error?: SetNewPinFromTokenError;
}

/**
 * E03 S05 — Public reset surface Server Action.
 *
 * Reachable WITHOUT a Group session — the middleware allowlist carries
 * `/pin/reset/` so the email-delivered link works from any browser.
 *
 * Per architecture I4 / story S05 AC: all three "token bad" causes (not found
 * / consumed / expired) collapse to a single opaque `invalid_or_expired`
 * outcome. The page MUST NOT leak which case applies.
 *
 * `pin_mismatch` is a distinct UX-time error (the two PIN fields didn't agree)
 * and is allowed to surface independently — it doesn't reveal anything about
 * the token's validity.
 */
export async function setNewPinFromTokenAction(
  _prev: SetNewPinFromTokenState,
  formData: FormData,
): Promise<SetNewPinFromTokenState> {
  const token = String(formData.get('token') ?? '').trim();
  const newPin = String(formData.get('new_pin') ?? '').trim();
  const newPinConfirm = String(formData.get('new_pin_confirm') ?? '').trim();

  if (newPin !== newPinConfirm) {
    log.warn({
      operation: 'recovery_reset_consume_action',
      outcome: 'rejected',
      reason: 'pin_mismatch',
    });
    return { error: 'pin_mismatch' };
  }

  const result = await consumeResetToken(token, newPin);
  if (!result.ok) {
    // Already logged inside consumeResetToken without raw token / PIN values.
    return { error: 'invalid_or_expired' };
  }

  revalidatePath('/login');
  revalidatePath('/me');

  log.info({
    operation: 'recovery_reset_consume_action',
    outcome: 'ok',
    user_id: result.userId,
  });

  return { ok: true };
}
