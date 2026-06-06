import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  signPayload,
  verifySignedPayload,
  type UnlockEntry,
} from './cookie';

const SECRET = 'test-secret-for-pin-cookie';

describe('signPayload / verifySignedPayload (pure)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('round-trips: signed payload verifies back to its entries', async () => {
    const now = 1_000_000;
    const entries: UnlockEntry[] = [
      { user_id: 'u1', exp: now + 60_000 },
      { user_id: 'u2', exp: now + 120_000 },
    ];
    const signed = await signPayload(entries, SECRET);
    const outcome = await verifySignedPayload(signed, SECRET, now);
    expect(outcome).toEqual({ kind: 'valid', entries });
  });

  it('prunes expired entries based on the injected clock', async () => {
    const now = 1_000_000;
    const entries: UnlockEntry[] = [
      { user_id: 'u-fresh', exp: now + 60_000 },
      { user_id: 'u-stale', exp: now - 1 },
    ];
    const signed = await signPayload(entries, SECRET);
    const outcome = await verifySignedPayload(signed, SECRET, now);
    expect(outcome).toEqual({
      kind: 'valid',
      entries: [{ user_id: 'u-fresh', exp: now + 60_000 }],
    });
  });

  it('returns `absent` for an undefined cookie', async () => {
    const outcome = await verifySignedPayload(undefined, SECRET, 0);
    expect(outcome).toEqual({ kind: 'absent' });
  });

  it('returns `invalid_signature` for a tampered tag', async () => {
    const now = 1_000_000;
    const signed = await signPayload([{ user_id: 'u1', exp: now + 1000 }], SECRET);
    // Flip the last byte of the signature portion.
    const dot = signed.lastIndexOf('.');
    const flipped =
      signed.slice(0, dot + 1) +
      (signed.endsWith('A') ? `${signed.slice(dot + 1, -1)}B` : `${signed.slice(dot + 1, -1)}A`);
    const outcome = await verifySignedPayload(flipped, SECRET, now);
    expect(outcome).toEqual({ kind: 'invalid_signature' });
  });

  it('returns `invalid_signature` for a payload signed with a different secret', async () => {
    const now = 1_000_000;
    const signed = await signPayload([{ user_id: 'u1', exp: now + 1000 }], 'other-secret');
    const outcome = await verifySignedPayload(signed, SECRET, now);
    expect(outcome).toEqual({ kind: 'invalid_signature' });
  });

  it('returns `invalid_signature` for malformed envelopes (no dot)', async () => {
    const outcome = await verifySignedPayload('not-a-signed-cookie', SECRET, 0);
    expect(outcome).toEqual({ kind: 'invalid_signature' });
  });

  it('returns `invalid_signature` when the JSON body is not an array', async () => {
    // Sign a non-array JSON to confirm we reject the shape.
    const body = Buffer.from(JSON.stringify({ user_id: 'u1', exp: 1 })).toString(
      'base64url',
    );
    const fakeSigned = `${body}.AAAA`;
    const outcome = await verifySignedPayload(fakeSigned, SECRET, 0);
    expect(outcome).toEqual({ kind: 'invalid_signature' });
  });
});
