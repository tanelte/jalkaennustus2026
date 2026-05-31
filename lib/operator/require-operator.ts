import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/db/schema';

export type OperatorGateReason = 'no_user' | 'not_operator';

export interface OperatorGateResult {
  ok: boolean;
  reason?: OperatorGateReason;
  userId?: string;
}

export interface OperatorRow {
  id: string;
  is_operator: boolean;
}

export interface AssertOperatorDeps {
  findUser: (userId: string) => Promise<OperatorRow | null>;
}

/**
 * Pure-ish gate: given a (possibly-null) current user id, decide whether the
 * caller is permitted on the /admin surface. Extracted so the layout, the
 * Server Actions, and the unit tests share one decision rule.
 */
export async function assertOperator(
  userId: string | null,
  deps: AssertOperatorDeps,
): Promise<OperatorGateResult> {
  if (!userId) return { ok: false, reason: 'no_user' };
  const row = await deps.findUser(userId);
  if (!row || !row.is_operator) {
    return { ok: false, reason: 'not_operator', userId };
  }
  return { ok: true, userId: row.id };
}

async function findUserDb(userId: string): Promise<OperatorRow | null> {
  const rows = await db
    .select({ id: users.id, is_operator: users.is_operator })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Default app-side impl. Server Actions and the layout use this. */
export async function checkOperator(userId: string | null): Promise<OperatorGateResult> {
  return assertOperator(userId, { findUser: findUserDb });
}
