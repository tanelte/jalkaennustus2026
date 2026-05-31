import { describe, expect, it, vi } from 'vitest';
import { assertOperator } from './require-operator';

describe('assertOperator', () => {
  it('rejects when no user id is provided', async () => {
    const findUser = vi.fn();
    const result = await assertOperator(null, { findUser });
    expect(result).toEqual({ ok: false, reason: 'no_user' });
    expect(findUser).not.toHaveBeenCalled();
  });

  it('rejects when the user row is missing', async () => {
    const findUser = vi.fn(async () => null);
    const result = await assertOperator('u-1', { findUser });
    expect(result).toEqual({ ok: false, reason: 'not_operator', userId: 'u-1' });
  });

  it('rejects when the user exists but is_operator=false', async () => {
    const findUser = vi.fn(async () => ({ id: 'u-1', is_operator: false }));
    const result = await assertOperator('u-1', { findUser });
    expect(result).toEqual({ ok: false, reason: 'not_operator', userId: 'u-1' });
  });

  it('approves an operator user', async () => {
    const findUser = vi.fn(async () => ({ id: 'u-1', is_operator: true }));
    const result = await assertOperator('u-1', { findUser });
    expect(result).toEqual({ ok: true, userId: 'u-1' });
  });
});
