import { describe, expect, it } from 'vitest';
import { signUserId, verifyUserId } from './sign-user-id';

const SECRET = 'test-secret-do-not-use-in-prod';

describe('signUserId / verifyUserId', () => {
  it('round-trips: a signed id verifies back to the same id', async () => {
    const signed = await signUserId('user-123', SECRET);
    expect(signed.startsWith('user-123.')).toBe(true);
    expect(await verifyUserId(signed, SECRET)).toBe('user-123');
  });

  it('returns null when signature is tampered', async () => {
    const signed = await signUserId('user-123', SECRET);
    const tampered = `${signed.slice(0, -2)}XX`;
    expect(await verifyUserId(tampered, SECRET)).toBeNull();
  });

  it('returns null when id is tampered (signature no longer matches)', async () => {
    const signed = await signUserId('user-123', SECRET);
    const tampered = `user-456.${signed.split('.')[1]}`;
    expect(await verifyUserId(tampered, SECRET)).toBeNull();
  });

  it('returns null when secret differs', async () => {
    const signed = await signUserId('user-123', SECRET);
    expect(await verifyUserId(signed, 'other-secret')).toBeNull();
  });

  it('returns null on undefined / empty / malformed input', async () => {
    expect(await verifyUserId(undefined, SECRET)).toBeNull();
    expect(await verifyUserId('', SECRET)).toBeNull();
    expect(await verifyUserId('no-dot-here', SECRET)).toBeNull();
    expect(await verifyUserId('.sigonly', SECRET)).toBeNull();
    expect(await verifyUserId('idonly.', SECRET)).toBeNull();
  });

  it('returns null when sig portion is not valid base64url', async () => {
    expect(await verifyUserId('user.!@#$%^&*()', SECRET)).toBeNull();
  });
});
