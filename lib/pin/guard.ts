/**
 * E03 S02 — PIN edit-mode guard.
 *
 * Sits in every prediction-write Server Action AFTER the stage-window gate and
 * BEFORE any DB write. Constitution §6 Rules 3, 5, 12 apply:
 *   - PIN is NOT a NextAuth provider (Rule 3) — the gate is in-action, not in
 *     `lib/auth/`.
 *   - Stage gate is the higher gate (Rule 5) — this guard never overrides a
 *     closed/not-yet-open stage.
 *   - No RLS / Postgres triggers (Rule 12) — gating lives in application code.
 *
 * `pin_rate_limited` is reachable from S06; this story never emits it but it is
 * part of the union for forward compatibility on every integrated action.
 */
import { eq } from 'drizzle-orm';

import { db as defaultDb } from '@/lib/db';
import { log } from '@/lib/log';
import { users } from '@/db/schema';
import { readUnlockedUsers } from './cookie';

export interface AssertEditAllowedArgs {
  groupId: string;
  userId: string;
}

export type PinGateReason = 'pin_required' | 'pin_rate_limited';
export type PinGateResult = { ok: true } | { ok: false; reason: PinGateReason };

/**
 * DI-only seam for tests. Default uses the live `db` and the cookie-bound
 * `readUnlockedUsers`. Tests inject in-memory stubs to avoid hitting Postgres
 * or `next/headers`.
 */
export interface AssertEditAllowedDeps {
  findPinHash: (userId: string) => Promise<string | null | undefined>;
  readUnlocked: () => Promise<Set<string>>;
}

async function findPinHashDb(userId: string): Promise<string | null | undefined> {
  const rows = await defaultDb
    .select({ pin_hash: users.pin_hash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0]?.pin_hash ?? null;
}

const defaultDeps: AssertEditAllowedDeps = {
  findPinHash: findPinHashDb,
  readUnlocked: () => readUnlockedUsers(),
};

export async function assertEditAllowedForUser(
  args: AssertEditAllowedArgs,
  deps: AssertEditAllowedDeps = defaultDeps,
): Promise<PinGateResult> {
  const { groupId, userId } = args;
  const pinHash = await deps.findPinHash(userId);

  if (!pinHash) {
    // No PIN configured for this user — guard is a no-op. Don't log on the
    // happy path; the stage-gate already produced the `ok` audit line and
    // double-logging would just create noise on every prediction submit.
    return { ok: true };
  }

  const unlocked = await deps.readUnlocked();
  if (unlocked.has(userId)) {
    log.info({
      operation: 'pin_guard_check',
      outcome: 'unlocked',
      user_id: userId,
      group_id: groupId,
    });
    return { ok: true };
  }

  log.info({
    operation: 'pin_guard_check',
    outcome: 'pin_required',
    user_id: userId,
    group_id: groupId,
  });
  return { ok: false, reason: 'pin_required' };
}
