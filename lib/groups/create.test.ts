import { describe, expect, it, vi } from 'vitest';
import { createGroupCore, type CreateGroupCoreDeps } from './create';

function makeDeps(overrides: Partial<CreateGroupCoreDeps> = {}): CreateGroupCoreDeps & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const warn = vi.fn();
  const error = vi.fn();
  return {
    findGroupByUsername: vi.fn(async () => null),
    insertGroup: vi.fn(async () => 'g-new'),
    hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
    log: { info, warn, error },
    info,
    warn,
    error,
    ...overrides,
  };
}

describe('createGroupCore', () => {
  it('rejects empty username', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: '', password: 'pw', password_confirm: 'pw' },
      deps,
    );
    expect(r).toEqual({ error: 'invalid_username' });
    expect(deps.insertGroup).not.toHaveBeenCalled();
  });

  it('rejects username shorter than 3 chars', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: 'ab', password: 'pw', password_confirm: 'pw' },
      deps,
    );
    expect(r).toEqual({ error: 'invalid_username' });
  });

  it('rejects username longer than 64 chars', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: 'x'.repeat(65), password: 'pw', password_confirm: 'pw' },
      deps,
    );
    expect(r).toEqual({ error: 'invalid_username' });
  });

  it('trims whitespace around username before validating', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: '  ab  ', password: 'pw', password_confirm: 'pw' },
      deps,
    );
    expect(r).toEqual({ error: 'invalid_username' });
  });

  it('rejects empty password', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: 'demo', password: '', password_confirm: '' },
      deps,
    );
    expect(r).toEqual({ error: 'invalid_password' });
    expect(deps.insertGroup).not.toHaveBeenCalled();
  });

  it('rejects mismatched password and confirmation', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: 'demo', password: 'one', password_confirm: 'two' },
      deps,
    );
    expect(r).toEqual({ error: 'password_mismatch' });
    expect(deps.insertGroup).not.toHaveBeenCalled();
  });

  it('rejects duplicate username', async () => {
    const deps = makeDeps({
      findGroupByUsername: vi.fn(async () => ({ id: 'existing' })),
    });
    const r = await createGroupCore(
      { username: 'demo', password: 'pw', password_confirm: 'pw' },
      deps,
    );
    expect(r).toEqual({ error: 'username_taken' });
    expect(deps.insertGroup).not.toHaveBeenCalled();
  });

  it('inserts on happy path and never logs cleartext password', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: 'demo', password: 'super-secret', password_confirm: 'super-secret' },
      deps,
    );
    expect(r).toEqual({ ok: true, group_id: 'g-new', username: 'demo' });
    expect(deps.hashPassword).toHaveBeenCalledWith('super-secret');
    expect(deps.insertGroup).toHaveBeenCalledWith('demo', 'hashed:super-secret');

    const allLogged = JSON.stringify([
      deps.info.mock.calls,
      deps.warn.mock.calls,
      deps.error.mock.calls,
    ]);
    expect(allLogged).not.toContain('super-secret');
    expect(allLogged).not.toContain('hashed:super-secret');
  });

  it('accepts a single-character password (hobby-app: no length floor)', async () => {
    const deps = makeDeps();
    const r = await createGroupCore(
      { username: 'demo', password: 'x', password_confirm: 'x' },
      deps,
    );
    expect(r).toEqual({ ok: true, group_id: 'g-new', username: 'demo' });
  });
});
