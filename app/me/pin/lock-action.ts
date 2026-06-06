'use server';

import { revalidatePath } from 'next/cache';

import { getCurrentUserId } from '@/lib/current-user';
import { log } from '@/lib/log';
import { removeUnlock } from '@/lib/pin/cookie';

/**
 * E03 S02 — "Lock now" dashboard action. Clears this user's entry from the
 * `pin_unlocked` cookie so the next prediction-write surface re-prompts. Bound
 * via `<form action={lockNowAction}>` from `/me` when PIN is enabled.
 */
export async function lockNowAction(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({ operation: 'pin_lock_now', outcome: 'rejected', reason: 'no_user' });
    return;
  }
  await removeUnlock(userId);
  log.info({ operation: 'pin_lock_now', outcome: 'ok', user_id: userId });
  revalidatePath('/me');
}
