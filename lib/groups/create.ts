/**
 * Pure core for creating a group — validation, uniqueness check, bcrypt hash,
 * insert. Extracted with injected dependencies so it can be unit-tested
 * without booting Next, NextAuth, or the DB.
 *
 * Password length is intentionally not constrained beyond non-empty — this is
 * a hobby private-league flow and members pick their own strength. Diverges
 * from `scripts/create-group.ts`, which is an operator tool.
 */

export interface CreateGroupCoreDeps {
  findGroupByUsername(username: string): Promise<{ id: string } | null>;
  insertGroup(username: string, password_hash: string): Promise<string>;
  hashPassword(plaintext: string): Promise<string>;
  log: {
    info(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
    warn(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
    error(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
  };
}

export type CreateGroupCoreError =
  | 'invalid_username'
  | 'invalid_password'
  | 'password_mismatch'
  | 'username_taken';

export interface CreateGroupCoreInput {
  username: string;
  password: string;
  password_confirm: string;
}

export type CreateGroupCoreResult =
  | { ok: true; group_id: string; username: string }
  | { error: CreateGroupCoreError };

const USERNAME_MIN = 3;
const USERNAME_MAX = 64;

export async function createGroupCore(
  input: CreateGroupCoreInput,
  deps: CreateGroupCoreDeps,
): Promise<CreateGroupCoreResult> {
  const username = input.username.trim();
  const password = input.password;
  const password_confirm = input.password_confirm;

  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    deps.log.warn({
      operation: 'group.create',
      outcome: 'rejected',
      reason: 'invalid_username',
    });
    return { error: 'invalid_username' };
  }
  if (password.length === 0) {
    deps.log.warn({
      operation: 'group.create',
      outcome: 'rejected',
      reason: 'invalid_password',
      username,
    });
    return { error: 'invalid_password' };
  }
  if (password !== password_confirm) {
    deps.log.warn({
      operation: 'group.create',
      outcome: 'rejected',
      reason: 'password_mismatch',
      username,
    });
    return { error: 'password_mismatch' };
  }

  const existing = await deps.findGroupByUsername(username);
  if (existing) {
    deps.log.warn({
      operation: 'group.create',
      outcome: 'rejected',
      reason: 'username_taken',
      username,
    });
    return { error: 'username_taken' };
  }

  const password_hash = await deps.hashPassword(password);
  const group_id = await deps.insertGroup(username, password_hash);

  deps.log.info({
    operation: 'group.create',
    outcome: 'ok',
    username,
    group_id,
  });
  return { ok: true, group_id, username };
}
