'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { removeUnlock } from '@/lib/pin/cookie';
import { hashPin, verifyPin } from '@/lib/pin/hash';
import { isValidPin } from '@/lib/pin/validate';
import { users } from '@/db/schema';

export type ChangePinError =
  | 'no_session'
  | 'no_user'
  | 'no_pin_set'
  | 'invalid_pin'
  | 'pin_mismatch'
  | 'wrong_current_pin';

export interface ChangePinState {
  ok?: boolean;
  error?: ChangePinError;
}

/**
 * E03 S03 — rotate a user's PIN. Requires successful verification of the
 * current PIN before the new one is hashed and persisted. The user's entry
 * in the `pin_unlocked` cookie is cleared on success so the next protected
 * action re-prompts (no silent carry-over of an unlock granted with the old
 * PIN). Raw PIN values are read once from formData and NEVER logged.
 */
export async function changePinAction(
  _prev: ChangePinState,
  formData: FormData,
): Promise<ChangePinState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    log.warn({ operation: 'pin_change', outcome: 'rejected', reason: 'no_session' });
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({
      operation: 'pin_change',
      outcome: 'rejected',
      reason: 'no_user',
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }

  const rows = await db
    .select({ pin_hash: users.pin_hash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    log.warn({
      operation: 'pin_change',
      outcome: 'rejected',
      reason: 'no_user',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }
  if (row.pin_hash === null) {
    log.warn({
      operation: 'pin_change',
      outcome: 'rejected',
      reason: 'no_pin_set',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_pin_set' };
  }

  const currentPinRaw = String(formData.get('current_pin') ?? '').trim();
  const newPinRaw = String(formData.get('new_pin') ?? '').trim();
  const newPinConfirmRaw = String(formData.get('new_pin_confirm') ?? '').trim();

  if (!isValidPin(newPinRaw)) {
    log.warn({
      operation: 'pin_change',
      outcome: 'rejected',
      reason: 'invalid_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'invalid_pin' };
  }

  if (newPinRaw !== newPinConfirmRaw) {
    log.warn({
      operation: 'pin_change',
      outcome: 'rejected',
      reason: 'pin_mismatch',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'pin_mismatch' };
  }

  const currentOk = await verifyPin(currentPinRaw, row.pin_hash);
  if (!currentOk) {
    log.warn({
      operation: 'pin_change',
      outcome: 'rejected',
      reason: 'wrong_current_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'wrong_current_pin' };
  }

  const newHash = await hashPin(newPinRaw);

  await db
    .update(users)
    .set({ pin_hash: newHash })
    .where(eq(users.id, userId));

  // Drop the existing unlock so the next protected action re-prompts with
  // the freshly-rotated PIN. The old PIN must not silently keep granting
  // access through a still-warm cookie entry.
  await removeUnlock(userId);

  log.info({
    operation: 'pin_change',
    outcome: 'ok',
    user_id: userId,
    group_id: session.user.group_id,
  });

  revalidatePath('/me');
  redirect('/me');
}
