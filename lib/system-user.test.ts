import { describe, expect, it, vi } from 'vitest';
import { resolveSystemUserId } from './system-user';

describe('resolveSystemUserId', () => {
  it('returns the id when finder yields one', async () => {
    const finder = vi.fn(async () => 'sys-1');
    await expect(resolveSystemUserId({ findSystemUserId: finder })).resolves.toBe('sys-1');
    expect(finder).toHaveBeenCalledOnce();
  });

  it('throws when no system-user row exists', async () => {
    const finder = vi.fn(async () => null);
    await expect(
      resolveSystemUserId({ findSystemUserId: finder }),
    ).rejects.toThrow(/tegelikud tulemused/);
  });
});
