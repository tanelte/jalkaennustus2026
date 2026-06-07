import { describe, expect, it, vi } from 'vitest';
import { joinGroupCore, type JoinGroupCoreDeps } from './join';

function makeDeps(overrides: Partial<JoinGroupCoreDeps> = {}): JoinGroupCoreDeps & {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
} {
  const info = vi.fn();
  const warn = vi.fn();
  return {
    verifyCredentials: vi.fn(async () => null),
    findMembership: vi.fn(async () => null),
    insertMembership: vi.fn(async () => undefined),
    log: { info, warn },
    info,
    warn,
    ...overrides,
  };
}

const BASE_INPUT = {
  username: 'colleagues',
  password: 'right',
  current_user_id: 'u-1',
  current_group_id: 'g-1',
  ip: '1.2.3.4',
};

describe('joinGroupCore', () => {
  it('rejects missing username without calling verify', async () => {
    const deps = makeDeps();
    const r = await joinGroupCore({ ...BASE_INPUT, username: '' }, deps);
    expect(r).toEqual({ error: 'missing_input' });
    expect(deps.verifyCredentials).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only username', async () => {
    const deps = makeDeps();
    const r = await joinGroupCore({ ...BASE_INPUT, username: '   ' }, deps);
    expect(r).toEqual({ error: 'missing_input' });
  });

  it('rejects missing password without calling verify', async () => {
    const deps = makeDeps();
    const r = await joinGroupCore({ ...BASE_INPUT, password: '' }, deps);
    expect(r).toEqual({ error: 'missing_input' });
    expect(deps.verifyCredentials).not.toHaveBeenCalled();
  });

  it('rejects when credential verification fails', async () => {
    const deps = makeDeps({ verifyCredentials: vi.fn(async () => null) });
    const r = await joinGroupCore(BASE_INPUT, deps);
    expect(r).toEqual({ error: 'invalid_credentials' });
    expect(deps.findMembership).not.toHaveBeenCalled();
    expect(deps.insertMembership).not.toHaveBeenCalled();
  });

  it('rejects when the verified group is the current group', async () => {
    const deps = makeDeps({
      verifyCredentials: vi.fn(async () => ({ id: 'g-1', name: 'friends' })),
    });
    const r = await joinGroupCore(BASE_INPUT, deps);
    expect(r).toEqual({ error: 'same_group' });
    expect(deps.findMembership).not.toHaveBeenCalled();
    expect(deps.insertMembership).not.toHaveBeenCalled();
  });

  it('rejects when membership already exists', async () => {
    const deps = makeDeps({
      verifyCredentials: vi.fn(async () => ({ id: 'g-2', name: 'colleagues' })),
      findMembership: vi.fn(async () => ({ user_id: 'u-1', group_id: 'g-2' })),
    });
    const r = await joinGroupCore(BASE_INPUT, deps);
    expect(r).toEqual({ error: 'already_member' });
    expect(deps.insertMembership).not.toHaveBeenCalled();
  });

  it('inserts membership and reports ok on success', async () => {
    const verify = vi.fn(async () => ({ id: 'g-2', name: 'colleagues' }));
    const insert = vi.fn(async () => undefined);
    const deps = makeDeps({
      verifyCredentials: verify,
      insertMembership: insert,
    });
    const r = await joinGroupCore(BASE_INPUT, deps);
    expect(r).toEqual({
      ok: true,
      joined_group_id: 'g-2',
      joined_username: 'colleagues',
    });
    expect(insert).toHaveBeenCalledWith('u-1', 'g-2');
    expect(deps.info).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'group.join',
        outcome: 'ok',
        actor_user_id: 'u-1',
        actor_group_id: 'g-1',
        target_group_id: 'g-2',
      }),
    );
  });

  it('does not log password material on any branch', async () => {
    const cases: Array<Partial<JoinGroupCoreDeps>> = [
      {},
      { verifyCredentials: vi.fn(async () => ({ id: 'g-1', name: 'friends' })) }, // same_group
      {
        verifyCredentials: vi.fn(async () => ({ id: 'g-2', name: 'colleagues' })),
        findMembership: vi.fn(async () => ({ user_id: 'u-1', group_id: 'g-2' })),
      }, // already_member
      {
        verifyCredentials: vi.fn(async () => ({ id: 'g-2', name: 'colleagues' })),
      }, // ok
    ];
    for (const override of cases) {
      const deps = makeDeps(override);
      await joinGroupCore({ ...BASE_INPUT, password: 'super-secret-pw' }, deps);
      const logged = JSON.stringify(
        deps.info.mock.calls.concat(deps.warn.mock.calls),
      );
      expect(logged).not.toContain('super-secret-pw');
    }
  });

  it('trims whitespace from the submitted username before verifying', async () => {
    const verify = vi.fn(async () => null);
    const deps = makeDeps({ verifyCredentials: verify });
    await joinGroupCore({ ...BASE_INPUT, username: '  colleagues  ' }, deps);
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'colleagues' }),
      '1.2.3.4',
    );
  });
});
