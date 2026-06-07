/**
 * Pure core for an authenticated user joining a second group via that group's
 * shared credentials. Extracted with injected dependencies so it can be
 * unit-tested without booting Next, NextAuth, the DB, or bcrypt.
 *
 * The `findMembership` probe is intentionally not filtered by `deleted_at` —
 * the PK `(user_id, group_id)` covers both active and soft-deleted rows, so a
 * soft-deleted membership would already block an insert. We surface that as
 * `already_member` rather than silently re-activating.
 */

export interface JoinGroupCoreDeps {
  verifyCredentials(
    input: { username: string; password: string },
    ip: string,
  ): Promise<{ id: string; name: string } | null>;
  findMembership(
    user_id: string,
    group_id: string,
  ): Promise<{ user_id: string; group_id: string } | null>;
  insertMembership(user_id: string, group_id: string): Promise<void>;
  log: {
    info(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
    warn(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
  };
}

export type JoinGroupCoreError =
  | 'missing_input'
  | 'invalid_credentials'
  | 'same_group'
  | 'already_member';

export interface JoinGroupCoreInput {
  username: string;
  password: string;
  current_user_id: string;
  current_group_id: string;
  ip: string;
}

export type JoinGroupCoreResult =
  | { ok: true; joined_group_id: string; joined_username: string }
  | { error: JoinGroupCoreError };

export async function joinGroupCore(
  input: JoinGroupCoreInput,
  deps: JoinGroupCoreDeps,
): Promise<JoinGroupCoreResult> {
  const username = input.username.trim();
  const password = input.password;

  if (!username || !password) {
    deps.log.warn({
      operation: 'group.join',
      outcome: 'rejected',
      reason: 'missing_input',
      actor_user_id: input.current_user_id,
      actor_group_id: input.current_group_id,
    });
    return { error: 'missing_input' };
  }

  const verified = await deps.verifyCredentials({ username, password }, input.ip);
  if (!verified) {
    return { error: 'invalid_credentials' };
  }

  if (verified.id === input.current_group_id) {
    deps.log.warn({
      operation: 'group.join',
      outcome: 'rejected',
      reason: 'same_group',
      actor_user_id: input.current_user_id,
      target_group_id: verified.id,
    });
    return { error: 'same_group' };
  }

  const existing = await deps.findMembership(input.current_user_id, verified.id);
  if (existing) {
    deps.log.warn({
      operation: 'group.join',
      outcome: 'rejected',
      reason: 'already_member',
      actor_user_id: input.current_user_id,
      target_group_id: verified.id,
    });
    return { error: 'already_member' };
  }

  await deps.insertMembership(input.current_user_id, verified.id);

  deps.log.info({
    operation: 'group.join',
    outcome: 'ok',
    actor_user_id: input.current_user_id,
    actor_group_id: input.current_group_id,
    target_group_id: verified.id,
    target_group_name: verified.name,
  });

  return { ok: true, joined_group_id: verified.id, joined_username: verified.name };
}
