'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { auth } from '@/lib/auth';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { hashPin } from '@/lib/pin/hash';
import { isValidEmail, isValidPin } from '@/lib/pin/validate';
import { users } from '@/db/schema';

export type EnablePinError =
  | 'no_session'
  | 'no_user'
  | 'already_enabled'
  | 'invalid_pin'
  | 'pin_mismatch'
  | 'invalid_email';

export interface EnablePinState {
  ok?: boolean;
  error?: EnablePinError;
}

/**
 * E03 S01 — enable a per-user PIN. The PIN is bcrypt-hashed (cost 12, same as
 * group passwords) before persistence; the raw value is read once from the
 * formData and never logged. The recovery email is stored in plaintext for
 * later use by the forgot-PIN flow (S05) — Constitution §2 carries the scoped
 * PII exception that allows this single, owner-only field.
 */
export async function enablePinAction(
  _prev: EnablePinState,
  formData: FormData,
): Promise<EnablePinState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    log.warn({ operation: 'pin_enable', outcome: 'rejected', reason: 'no_session' });
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({
      operation: 'pin_enable',
      outcome: 'rejected',
      reason: 'no_user',
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }

  const pinRaw = String(formData.get('pin') ?? '').trim();
  const pinConfirmRaw = String(formData.get('pin_confirm') ?? '').trim();
  const recoveryEmailRaw = String(formData.get('recovery_email') ?? '').trim();

  if (!isValidPin(pinRaw)) {
    log.warn({
      operation: 'pin_enable',
      outcome: 'rejected',
      reason: 'invalid_pin',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'invalid_pin' };
  }

  if (pinRaw !== pinConfirmRaw) {
    log.warn({
      operation: 'pin_enable',
      outcome: 'rejected',
      reason: 'pin_mismatch',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'pin_mismatch' };
  }

  if (!isValidEmail(recoveryEmailRaw)) {
    log.warn({
      operation: 'pin_enable',
      outcome: 'rejected',
      reason: 'invalid_email',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'invalid_email' };
  }

  const existing = await db
    .select({ pin_hash: users.pin_hash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing[0]) {
    log.warn({
      operation: 'pin_enable',
      outcome: 'rejected',
      reason: 'no_user',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }

  if (existing[0].pin_hash !== null) {
    log.warn({
      operation: 'pin_enable',
      outcome: 'rejected',
      reason: 'already_enabled',
      user_id: userId,
      group_id: session.user.group_id,
    });
    return { error: 'already_enabled' };
  }

  const hash = await hashPin(pinRaw);

  await db
    .update(users)
    .set({ pin_hash: hash, recovery_email: recoveryEmailRaw })
    .where(eq(users.id, userId));

  revalidatePath('/me');

  log.info({
    operation: 'pin_enable',
    outcome: 'ok',
    user_id: userId,
    group_id: session.user.group_id,
  });

  return { ok: true };
}
