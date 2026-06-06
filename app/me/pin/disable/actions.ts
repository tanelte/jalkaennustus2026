'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { removeUnlock } from '@/lib/pin/cookie';
import { verifyPin } from '@/lib/pin/hash';
import { user_pin_resets, users } from '@/db/schema';

export type DisablePinError = 'no_session' | 'no_user' | 'no_pin_set' | 'wrong_pin';

export interface DisablePinState {
  ok?: boolean;
  error?: DisablePinError;
}

/**
 * E03 S04 — atomic PIN disable.
 *
 * Verifies the current PIN BEFORE opening the transaction, so a `wrong_pin`
 * outcome guarantees that `pin_hash`, `recovery_email`, and any pending
 * `user_pin_resets` rows are left untouched (S04 AC).
 *
 * On success a single `db.transaction` clears:
 *   - `users.pin_hash = null`
 *   - `users.recovery_email = null`
 *   - DELETE FROM `user_pin_resets` WHERE user_id = ? AND consumed_at IS NULL
 *
 * The combined clear closes R-5: a forgotten/leaked reset link must not stay
 * live after the user explicitly disables PIN protection. Then the
 * `pin_unlocked` cookie entry for this user is dropped. Raw PIN values and
 * recovery_email contents are NEVER logged.
 */
export async function disablePinAction(
  _prev: DisablePinState,
  formData: FormData,
): Promise<DisablePinState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    log.warn({ operation: 'pin_disable', outcome: 'rejected', reason: 'no_session' });
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({
      operation: 'pin_disable',
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
      operation: 'pin_disable',
      outcome: 'rejected',
      reason: 'no_user',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }
  if (row.pin_hash === null) {
    log.warn({
      operation: 'pin_disable',
      outcome: 'rejected',
      reason: 'no_pin_set',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_pin_set' };
  }

  const currentPinRaw = String(formData.get('current_pin') ?? '').trim();
  const currentOk = await verifyPin(currentPinRaw, row.pin_hash);
  if (!currentOk) {
    // S04 AC: wrong_pin must NOT mutate any state. The transaction below has
    // not been opened yet, so pin_hash, recovery_email, and any pending reset
    // rows are guaranteed untouched.
    log.warn({
      operation: 'pin_disable',
      outcome: 'rejected',
      reason: 'wrong_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'wrong_pin' };
  }

  // Atomic clear (D4). pin_hash + recovery_email + unconsumed reset rows
  // either all go or none do.
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ pin_hash: null, recovery_email: null })
      .where(eq(users.id, userId));
    await tx
      .delete(user_pin_resets)
      .where(
        and(
          eq(user_pin_resets.user_id, userId),
          isNull(user_pin_resets.consumed_at),
        ),
      );
  });

  // The PIN no longer exists; drop this user's unlock entry so no stale
  // "unlocked" state can survive a re-enable.
  await removeUnlock(userId);

  log.info({
    operation: 'pin_disable',
    outcome: 'ok',
    user_id: userId,
    group_id: session.user.group_id,
  });

  revalidatePath('/me');
  redirect('/me');
}
