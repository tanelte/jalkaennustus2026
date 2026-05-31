'use server';

import { AuthError } from 'next-auth';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
import { signIn } from '@/lib/auth';
import { db } from '@/lib/db';
import { groups } from '@/db/schema';
import { log } from '@/lib/log';
import { increment, peek } from '@/lib/ratelimit';
import { createGroupCore, type CreateGroupCoreDeps } from '@/lib/groups/create';

export type CreateGroupError =
  | 'invalid_username'
  | 'invalid_password'
  | 'password_mismatch'
  | 'username_taken'
  | 'rate_limited';

export interface CreateGroupState {
  ok?: true;
  error?: CreateGroupError;
}

const BCRYPT_COST = 12;

async function extractIp(): Promise<string> {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

const deps: CreateGroupCoreDeps = {
  async findGroupByUsername(username) {
    const rows = await db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.username, username))
      .limit(1);
    return rows[0] ?? null;
  },
  async insertGroup(username, password_hash) {
    const inserted = await db
      .insert(groups)
      .values({ username, password_hash })
      .returning({ id: groups.id });
    return inserted[0]!.id;
  },
  hashPassword: (pw) => bcryptjs.hash(pw, BCRYPT_COST),
  log,
};

export async function createGroupAction(
  _prev: CreateGroupState,
  formData: FormData,
): Promise<CreateGroupState> {
  const ip = await extractIp();
  if (peek(ip)) {
    log.warn({ operation: 'group.create', outcome: 'rate_limited', ip });
    return { error: 'rate_limited' };
  }
  increment(ip);

  const username = String(formData.get('username') ?? '');
  const password = String(formData.get('password') ?? '');
  const password_confirm = String(formData.get('password_confirm') ?? '');

  const result = await createGroupCore({ username, password, password_confirm }, deps);
  if ('error' in result) {
    return { error: result.error };
  }

  try {
    await signIn('credentials', {
      username: result.username,
      password,
      redirectTo: '/select-user',
    });
  } catch (err) {
    // signIn() with redirectTo throws NEXT_REDIRECT on success; let it propagate.
    if (err instanceof AuthError) {
      // Should not happen — we just inserted these credentials. Log and report.
      log.error({
        operation: 'group.create',
        outcome: 'post_create_signin_failed',
        group_id: result.group_id,
        username: result.username,
      });
      return { error: 'invalid_username' };
    }
    throw err;
  }
  return { ok: true };
}
