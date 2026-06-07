'use server';

import bcryptjs from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { groups, user_groups } from '@/db/schema';
import { auth } from '@/lib/auth';
import { verifyGroupCredentials } from '@/lib/auth/credentials';
import { getCurrentUserId } from '@/lib/current-user';
import { db } from '@/lib/db';
import { joinGroupCore, type JoinGroupCoreError } from '@/lib/groups/join';
import { log } from '@/lib/log';
import { increment, peek, reset as resetRateLimit } from '@/lib/ratelimit';

export type JoinGroupError =
  | 'no_session'
  | 'no_user'
  | 'rate_limited'
  | JoinGroupCoreError;

export interface JoinGroupState {
  ok?: boolean;
  error?: JoinGroupError;
  joined_username?: string;
}

async function extractIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

export async function joinGroupAction(
  _prev: JoinGroupState,
  formData: FormData,
): Promise<JoinGroupState> {
  const session = await auth();
  if (!session?.user?.group_id) {
    log.warn({ operation: 'group.join', outcome: 'rejected', reason: 'no_session' });
    return { error: 'no_session' };
  }

  const userId = await getCurrentUserId();
  if (!userId) {
    log.warn({
      operation: 'group.join',
      outcome: 'rejected',
      reason: 'no_user',
      actor_group_id: session.user.group_id,
    });
    return { error: 'no_user' };
  }

  const ip = await extractIp();
  if (peek(ip)) {
    log.warn({ operation: 'group.join', outcome: 'rate_limited', ip });
    return { error: 'rate_limited' };
  }
  increment(ip);

  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');

  const result = await joinGroupCore(
    {
      username,
      password,
      current_user_id: userId,
      current_group_id: session.user.group_id,
      ip,
    },
    {
      async verifyCredentials({ username, password }, attemptIp) {
        return verifyGroupCredentials({ username, password }, attemptIp, {
          async findGroupByUsername(name) {
            const rows = await db
              .select()
              .from(groups)
              .where(eq(groups.username, name))
              .limit(1);
            return rows[0] ?? null;
          },
          comparePassword: (pw, hash) => bcryptjs.compare(pw, hash),
          log,
          resetRateLimit,
        });
      },
      async findMembership(user_id, group_id) {
        const rows = await db
          .select({ user_id: user_groups.user_id, group_id: user_groups.group_id })
          .from(user_groups)
          .where(
            and(eq(user_groups.user_id, user_id), eq(user_groups.group_id, group_id)),
          )
          .limit(1);
        return rows[0] ?? null;
      },
      async insertMembership(user_id, group_id) {
        await db.insert(user_groups).values({ user_id, group_id });
      },
      log,
    },
  );

  if ('error' in result) {
    return { error: result.error };
  }

  revalidatePath('/me');
  return { ok: true, joined_username: result.joined_username };
}
