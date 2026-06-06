import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin, PIN_BCRYPT_COST } from './hash';

describe('hashPin / verifyPin', () => {
  it('round-trips: a hashed PIN verifies back to true with the same input', async () => {
    const hash = await hashPin('1234');
    expect(hash).not.toBe('1234');
    expect(hash.length).toBeGreaterThan(20);
    expect(await verifyPin('1234', hash)).toBe(true);
  });

  it('returns false for a wrong PIN', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('4321', hash)).toBe(false);
  });

  it('returns false for empty raw input', async () => {
    const hash = await hashPin('1234');
    expect(await verifyPin('', hash)).toBe(false);
  });

  it('returns false for empty hash input', async () => {
    expect(await verifyPin('1234', '')).toBe(false);
  });

  it('uses cost 12 (same work factor as group passwords)', async () => {
    expect(PIN_BCRYPT_COST).toBe(12);
    const hash = await hashPin('0000');
    // bcrypt format: $2<a/b>$<cost>$<salt+hash>
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('produces a different hash on each call (salted)', async () => {
    const a = await hashPin('1234');
    const b = await hashPin('1234');
    expect(a).not.toBe(b);
  });
});
