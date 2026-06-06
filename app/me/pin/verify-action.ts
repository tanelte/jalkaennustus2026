'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { addUnlock, PIN_UNLOCK_TTL_MS } from '@/lib/pin/cookie';
import { verifyPin } from '@/lib/pin/hash';
import {
  isPinRateLimited,
  recordPinFailure,
  resetPinRateLimit,
} from '@/lib/pin/rate-limit';
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
 * E03 S02 + S06 — verify a PIN entered in the modal. On success, write a
 * 30-minute sliding unlock entry for this user into the signed `pin_unlocked`
 * cookie. S06 layers a token-bucket rate-limit (5 fails / 15 min per
 * `pin:{group_id}:{user_id}`) on top: peek before bcrypt, increment on every
 * failed attempt, reset on success. No permanent lockout — `Forgot your PIN?`
 * remains reachable in the modal.
 *
 * Malformed and wrong PINs both surface `wrong_pin` — we don't leak whether
 * the value-shape was even valid. Both also count against the rate-limit
 * bucket so a brute-forcer cannot dodge the limit with junk inputs.
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

  // S06 — rate-limit gate. Check BEFORE loading the hash or running bcrypt so
  // a saturated bucket short-circuits the expensive path. Key shape per
  // architecture D6: `pin:{group_id}:{user_id}`.
  const rateLimitArgs = { groupId: session.user.group_id, userId };
  if (isPinRateLimited(rateLimitArgs)) {
    return { error: 'pin_rate_limited' };
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

  // Treat malformed and wrong the same way — no shape-leak. Both increment
  // the rate-limit bucket so a brute-forcer can't dodge it with junk inputs.
  if (!isValidPin(raw)) {
    recordPinFailure(rateLimitArgs);
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
    recordPinFailure(rateLimitArgs);
    log.warn({
      operation: 'pin_verify',
      outcome: 'rejected',
      reason: 'wrong_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'wrong_pin' };
  }

  resetPinRateLimit(rateLimitArgs);
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
