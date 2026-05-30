import { describe, expect, it, vi } from 'vitest';
import type { Group } from '@/db/schema';
import { verifyGroupCredentials, type VerifyDeps } from './credentials';

function makeDeps(overrides: Partial<VerifyDeps> = {}): VerifyDeps & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const warn = vi.fn();
  const reset = vi.fn();
  return {
    findGroupByUsername: vi.fn(async () => null),
    comparePassword: vi.fn(async () => false),
    log: { info, warn },
    resetRateLimit: reset,
    info,
    warn,
    reset,
    ...overrides,
  };
}

function makeGroup(over: Partial<Group> = {}): Group {
  return {
    id: 'g-1',
    username: 'demo',
    password_hash: '$2b$12$hash',
    created_at: new Date(),
    ...over,
  };
}

describe('verifyGroupCredentials', () => {
  it('rejects missing username', async () => {
    const deps = makeDeps();
    const r = await verifyGroupCredentials({ password: 'x' }, '1.1.1.1', deps);
    expect(r).toBeNull();
    expect(deps.warn).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'auth_failure_credentials', reason: 'missing_fields' }),
    );
  });

  it('rejects missing password', async () => {
    const deps = makeDeps();
    const r = await verifyGroupCredentials({ username: 'demo' }, '1.1.1.1', deps);
    expect(r).toBeNull();
    expect(deps.warn).toHaveBeenCalled();
  });

  it('rejects unknown username and logs auth_failure_credentials', async () => {
    const deps = makeDeps({ findGroupByUsername: vi.fn(async () => null) });
    const r = await verifyGroupCredentials({ username: 'nope', password: 'x' }, '1.1.1.1', deps);
    expect(r).toBeNull();
    expect(deps.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'auth_failure_credentials',
        reason: 'unknown_username',
        username: 'nope',
        ip: '1.1.1.1',
      }),
    );
  });

  it('rejects bad password and never logs cleartext', async () => {
    const deps = makeDeps({
      findGroupByUsername: vi.fn(async () => makeGroup()),
      comparePassword: vi.fn(async () => false),
    });
    const r = await verifyGroupCredentials(
      { username: 'demo', password: 'wrong' },
      '1.1.1.1',
      deps,
    );
    expect(r).toBeNull();
    expect(deps.comparePassword).toHaveBeenCalledWith('wrong', '$2b$12$hash');
    expect(deps.warn).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'auth_failure_credentials', reason: 'bad_password' }),
    );
    const allLogged = JSON.stringify(deps.warn.mock.calls);
    expect(allLogged).not.toContain('wrong');
  });

  it('accepts correct credentials, resets rate-limit, and returns group identity', async () => {
    const deps = makeDeps({
      findGroupByUsername: vi.fn(async () => makeGroup()),
      comparePassword: vi.fn(async () => true),
    });
    const r = await verifyGroupCredentials(
      { username: 'demo', password: 'right' },
      '9.9.9.9',
      deps,
    );
    expect(r).toEqual({ id: 'g-1', name: 'demo' });
    expect(deps.reset).toHaveBeenCalledWith('9.9.9.9');
    expect(deps.info).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'auth_success', username: 'demo', ip: '9.9.9.9' }),
    );
  });

  it('trims whitespace from username before lookup', async () => {
    const find = vi.fn(async () => makeGroup());
    const deps = makeDeps({
      findGroupByUsername: find,
      comparePassword: vi.fn(async () => true),
    });
    await verifyGroupCredentials({ username: '  demo  ', password: 'right' }, 'x', deps);
    expect(find).toHaveBeenCalledWith('demo');
  });
});
