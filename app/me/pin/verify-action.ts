'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { addUnlock, PIN_UNLOCK_TTL_MS } from '@/lib/pin/cookie';
import { verifyPin } from '@/lib/pin/hash';
import { isValidPin } from '@/lib/pin/validate';
import { users } from '@/db/schema';

export type VerifyPinError =
  | 'no_session'
  | 'no_user'
  | 'wrong_pin'
  | 'no_pin_set'
  | 'pin_rate_limited';

export interface VerifyPinState {
  ok?: boolean;
  error?: VerifyPinError;
}

/**
 * E03 S02 — verify a PIN entered in the modal. On success, write a 30-minute
 * sliding unlock entry for this user into the signed `pin_unlocked` cookie.
 *
 * `pin_rate_limited` is reachable from S06 — this story never emits it, but it
 * lives in the error union so the modal's ERROR_COPY can carry the matching
 * Estonian copy and S06 only needs to wire the bucket.
 *
 * Malformed and wrong PINs both surface `wrong_pin` — we don't leak whether
 * the value-shape was even valid.
 */
export async function verifyPinAction(
  _prev: VerifyPinState,
  formData: FormData,
): Promise<VerifyPinState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    log.warn({ operation: 'pin_verify', outcome: 'rejected', reason: 'no_session' });
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({
      operation: 'pin_verify',
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
      operation: 'pin_verify',
      outcome: 'rejected',
      reason: 'no_user',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }
  if (row.pin_hash === null) {
    log.warn({
      operation: 'pin_verify',
      outcome: 'rejected',
      reason: 'no_pin_set',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_pin_set' };
  }

  const rawValue = formData.get('pin');
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';

  // Treat malformed and wrong the same way — no shape-leak.
  if (!isValidPin(raw)) {
    log.warn({
      operation: 'pin_verify',
      outcome: 'rejected',
      reason: 'wrong_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'wrong_pin' };
  }

  const ok = await verifyPin(raw, row.pin_hash);
  if (!ok) {
    log.warn({
      operation: 'pin_verify',
      outcome: 'rejected',
      reason: 'wrong_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'wrong_pin' };
  }

  await addUnlock(userId, PIN_UNLOCK_TTL_MS);
  revalidatePath('/me');

  log.info({
    operation: 'pin_verify',
    outcome: 'ok',
    user_id: userId,
    group_id: session.user.group_id,
  });

  return { ok: true };
}
