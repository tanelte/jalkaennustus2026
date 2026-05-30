'use server';

import { and, eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { setCurrentUserCookie } from '@/lib/current-user';
import { db } from '@/lib/db';
import { log } from '@/lib/log';
import { user_groups, users } from '@/db/schema';

async function requireGroupId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.group_id) {
    redirect('/login');
  }
  return session.user.group_id;
}

export async function selectExistingUser(formData: FormData): Promise<void> {
  const groupId = await requireGroupId();
  const userId = String(formData.get('user_id') ?? '');

  if (!userId) {
    log.warn({ operation: 'select_user', outcome: 'rejected', reason: 'missing_user_id' });
    redirect('/select-user');
  }

  const membership = await db
    .select({ user_id: user_groups.user_id })
    .from(user_groups)
    .where(and(eq(user_groups.group_id, groupId), eq(user_groups.user_id, userId)))
    .limit(1);

  if (membership.length === 0) {
    log.warn({
      operation: 'select_user',
      outcome: 'rejected',
      reason: 'not_a_member',
      group_id: groupId,
    });
    redirect('/select-user');
  }

  await setCurrentUserCookie(userId);
  log.info({ operation: 'select_user', outcome: 'ok', group_id: groupId, user_id: userId });
  redirect('/');
}

export async function createAndSelectUser(formData: FormData): Promise<void> {
  const groupId = await requireGroupId();
  const username = String(formData.get('username') ?? '').trim();

  if (!username || username.length > 64) {
    log.warn({ operation: 'create_user', outcome: 'rejected', reason: 'invalid_username' });
    redirect('/select-user');
  }

  const userId = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const existingUserId = existing[0]?.id;
    if (existingUserId) {
      // Username already taken globally. Attach to this group if not already, then reuse it.
      await tx
        .insert(user_groups)
        .values({ user_id: existingUserId, group_id: groupId })
        .onConflictDoNothing();
      return existingUserId;
    }

    const inserted = await tx
      .insert(users)
      .values({ username })
      .returning({ id: users.id });
    const newUserId = inserted[0]!.id;
    await tx.insert(user_groups).values({ user_id: newUserId, group_id: groupId });
    return newUserId;
  });

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
