'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { setCurrentUserCookie } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { user_groups, users } from '@/db/schema';

export type SelectUserError =
  | 'no_session'
  | 'missing_user_id'
  | 'not_a_member'
  | 'invalid_username'
  | 'username_taken_in_group';

export interface SelectUserState {
  ok?: true;
  error?: SelectUserError;
}

async function getGroupId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.group_id ?? null;
}

export async function selectExistingUser(
  _prev: SelectUserState,
  formData: FormData,
): Promise<SelectUserState> {
  const groupId = await getGroupId();
  if (!groupId) {
    return { error: 'no_session' };
  }

  const userId = String(formData.get('user_id') ?? '');
  if (!userId) {
    log.warn({ operation: 'select_user', outcome: 'rejected', reason: 'missing_user_id' });
    return { error: 'missing_user_id' };
  }

  const membership = await db
    .select({ user_id: user_groups.user_id })
    .from(user_groups)
    .where(
      and(
        eq(user_groups.group_id, groupId),
        eq(user_groups.user_id, userId),
        isNull(user_groups.deleted_at),
      ),
    )
    .limit(1);

  if (membership.length === 0) {
    log.warn({
      operation: 'select_user',
      outcome: 'rejected',
      reason: 'not_a_member',
      group_id: groupId,
    });
    return { error: 'not_a_member' };
  }

  await setCurrentUserCookie(userId);
  log.info({ operation: 'select_user', outcome: 'ok', group_id: groupId, user_id: userId });
  redirect('/');
}

export async function createAndSelectUser(
  _prev: SelectUserState,
  formData: FormData,
): Promise<SelectUserState> {
  const groupId = await getGroupId();
  if (!groupId) {
    return { error: 'no_session' };
  }

  const username = String(formData.get('username') ?? '').trim();

  if (!username || username.length > 64) {
    log.warn({ operation: 'create_user', outcome: 'rejected', reason: 'invalid_username' });
    return { error: 'invalid_username' };
  }

  const result = await db.transaction(async (tx) => {
    const collision = await tx
      .select({ id: users.id })
      .from(users)
      .innerJoin(user_groups, eq(user_groups.user_id, users.id))
      .where(
        and(
          eq(users.username, username),
          eq(user_groups.group_id, groupId),
          isNull(user_groups.deleted_at),
        ),
      )
      .limit(1);

    if (collision.length > 0) {
      return { taken: true as const };
    }

    const inserted = await tx
      .insert(users)
      .values({ username })
      .returning({ id: users.id });
    const newUserId = inserted[0]!.id;
    await tx.insert(user_groups).values({ user_id: newUserId, group_id: groupId });
    return { taken: false as const, userId: newUserId };
  });

  if (result.taken) {
    log.warn({
      operation: 'create_user',
      outcome: 'rejected',
      reason: 'username_taken_in_group',
      group_id: groupId,
      username,
    });
    return { error: 'username_taken_in_group' };
  }

  const userId = result.userId;

  await setCurrentUserCookie(userId);
  log.info({
    operation: 'create_user',
    outcome: 'ok',
    group_id: groupId,
    user_id: userId,
    username,
  });
  redirect('/');
}
