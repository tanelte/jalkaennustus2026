/**
 * Group credential verification — extracted as a pure function with injected
 * dependencies so it can be unit-tested without booting NextAuth, the DB, or
 * bcryptjs.
 */
import type { Group } from '@/db/schema';

export interface VerifyDeps {
  findGroupByUsername(username: string): Promise<Group | null>;
  comparePassword(plaintext: string, hash: string): Promise<boolean>;
  log: {
    info(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
    warn(fields: Record<string, unknown> & { operation: string; outcome: string }): void;
  };
  resetRateLimit(ip: string): void;
}

export interface VerifiedGroup {
  id: string;
  name: string;
}

export async function verifyGroupCredentials(
  raw: { username?: unknown; password?: unknown },
  ip: string,
  deps: VerifyDeps,
): Promise<VerifiedGroup | null> {
  const username = typeof raw.username === 'string' ? raw.username.trim() : '';
  const password = typeof raw.password === 'string' ? raw.password : '';

  if (!username || !password) {
    deps.log.warn({
      operation: 'auth',
      outcome: 'auth_failure_credentials',
      reason: 'missing_fields',
      username,
      ip,
    });
    return null;
  }

  const group = await deps.findGroupByUsername(username);
  if (!group) {
    deps.log.warn({
      operation: 'auth',
      outcome: 'auth_failure_credentials',
      reason: 'unknown_username',
      username,
      ip,
    });
    return null;
  }

  const ok = await deps.comparePassword(password, group.password_hash);
  if (!ok) {
    deps.log.warn({
      operation: 'auth',
      outcome: 'auth_failure_credentials',
      reason: 'bad_password',
      username,
      ip,
    });
    return null;
  }

  deps.resetRateLimit(ip);
  deps.log.info({ operation: 'auth', outcome: 'auth_success', username, ip });
  return { id: group.id, name: group.username };
}
