import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { assertEditAllowedForUser, type AssertEditAllowedDeps } from './guard';

function makeDeps(overrides: Partial<AssertEditAllowedDeps>): AssertEditAllowedDeps {
  return {
    findPinHash: vi.fn().mockResolvedValue(null),
    readUnlocked: vi.fn().mockResolvedValue(new Set<string>()),
    ...overrides,
  };
}

describe('assertEditAllowedForUser', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows the edit when the user has no PIN configured', async () => {
    const deps = makeDeps({ findPinHash: vi.fn().mockResolvedValue(null) });
    const result = await assertEditAllowedForUser(
      { groupId: 'g1', userId: 'u1' },
      deps,
    );
    expect(result).toEqual({ ok: true });
    expect(deps.readUnlocked).not.toHaveBeenCalled();
  });

  it('treats an absent column (undefined) the same as null', async () => {
    const deps = makeDeps({ findPinHash: vi.fn().mockResolvedValue(undefined) });
    const result = await assertEditAllowedForUser(
      { groupId: 'g1', userId: 'u1' },
      deps,
    );
    expect(result).toEqual({ ok: true });
  });

  it('returns pin_required when PIN is set and no unlock cookie covers the user', async () => {
    const deps = makeDeps({
      findPinHash: vi.fn().mockResolvedValue('$2b$12$something'),
      readUnlocked: vi.fn().mockResolvedValue(new Set<string>()),
    });
    const result = await assertEditAllowedForUser(
      { groupId: 'g1', userId: 'u1' },
      deps,
    );
    expect(result).toEqual({ ok: false, reason: 'pin_required' });
  });

  it('allows the edit when PIN is set and the unlock cookie carries the user', async () => {
    const deps = makeDeps({
      findPinHash: vi.fn().mockResolvedValue('$2b$12$something'),
      readUnlocked: vi.fn().mockResolvedValue(new Set(['u1'])),
    });
    const result = await assertEditAllowedForUser(
      { groupId: 'g1', userId: 'u1' },
      deps,
    );
    expect(result).toEqual({ ok: true });
  });

  it('does not unlock when the cookie carries a different user', async () => {
    const deps = makeDeps({
      findPinHash: vi.fn().mockResolvedValue('$2b$12$something'),
      readUnlocked: vi.fn().mockResolvedValue(new Set(['other-user'])),
    });
    const result = await assertEditAllowedForUser(
      { groupId: 'g1', userId: 'u1' },
      deps,
    );
    expect(result).toEqual({ ok: false, reason: 'pin_required' });
  });
});
