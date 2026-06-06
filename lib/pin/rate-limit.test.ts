/**
 * E03 S06 — exercises the real `lib/ratelimit.ts` token-bucket via the PIN
 * rate-limit helper so the integration is genuinely covered, not just the
 * helper's call-shape.
 *
 * Out of scope per AC: the Forgot-PIN reachability assertion. The modal
 * (`components/pin/pin-entry-modal.tsx`) renders the "Unustasid PIN-i?" link
 * whenever the user has a recovery email — regardless of `verifyState.error`
 * — so a `pin_rate_limited` error does not hide it. That's a UI invariant,
 * tested at the component level when/if pin-entry-modal gains a unit test.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import {
  isPinRateLimited,
  pinRateLimitKey,
  recordPinFailure,
  resetPinRateLimit,
} from './rate-limit';
import { _clearForTests, LIMIT } from '@/lib/ratelimit';

const args = { groupId: 'g1', userId: 'u1' };

describe('PIN rate-limit helper', () => {
  beforeEach(() => {
    _clearForTests();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    _clearForTests();
  });

  it('produces the architecture D6 key shape', () => {
    expect(pinRateLimitKey(args)).toBe('pin:g1:u1');
  });

  it('starts in a non-rate-limited state', () => {
    expect(isPinRateLimited(args)).toBe(false);
  });

  it('returns rate-limited on the 6th attempt after 5 failures', () => {
    // 5 failed attempts fill the bucket exactly.
    for (let i = 0; i < LIMIT; i += 1) {
      expect(isPinRateLimited(args)).toBe(false);
      recordPinFailure(args);
    }

    // The 6th call sees a full bucket and short-circuits.
    expect(isPinRateLimited(args)).toBe(true);
  });

  it('success resets the bucket so a fresh streak of failures starts at zero', () => {
    // 4 wrong PINs — still under the limit.
    for (let i = 0; i < 4; i += 1) {
      expect(isPinRateLimited(args)).toBe(false);
      recordPinFailure(args);
    }
    expect(isPinRateLimited(args)).toBe(false);

    // A correct PIN resets the bucket.
    resetPinRateLimit(args);

    // Another correct PIN — still not rate-limited (this verifies reset is
    // idempotent and doesn't fall over when called on an empty bucket).
    expect(isPinRateLimited(args)).toBe(false);
    resetPinRateLimit(args);

    // The user can now make 5 more wrong attempts before being limited —
    // confirming the reset actually cleared the prior 4 entries.
    for (let i = 0; i < LIMIT; i += 1) {
      expect(isPinRateLimited(args)).toBe(false);
      recordPinFailure(args);
    }
    expect(isPinRateLimited(args)).toBe(true);
  });

  it('keys are scoped per (group_id, user_id) — one user does not affect another', () => {
    const a = { groupId: 'g1', userId: 'u1' };
    const b = { groupId: 'g1', userId: 'u2' };

    // Fill u1's bucket completely.
    for (let i = 0; i < LIMIT; i += 1) recordPinFailure(a);
    expect(isPinRateLimited(a)).toBe(true);

    // u2 is unaffected.
    expect(isPinRateLimited(b)).toBe(false);
  });

  it('keys are scoped per group too — same user_id in a different group is independent', () => {
    const a = { groupId: 'g1', userId: 'u1' };
    const b = { groupId: 'g2', userId: 'u1' };

    for (let i = 0; i < LIMIT; i += 1) recordPinFailure(a);
    expect(isPinRateLimited(a)).toBe(true);
    expect(isPinRateLimited(b)).toBe(false);
  });

  it('emits a structured pin_rate_limit log line on hit (NFR-3)', () => {
    const logSpy = vi.spyOn(console, 'log');
    for (let i = 0; i < LIMIT; i += 1) recordPinFailure(args);
    logSpy.mockClear();

    expect(isPinRateLimited(args)).toBe(true);
    const lines = logSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((line) => typeof line === 'string')
      .map((line) => JSON.parse(line));
    const hit = lines.find(
      (l: { operation?: string; outcome?: string }) =>
        l.operation === 'pin_rate_limit' && l.outcome === 'hit',
    );
    expect(hit).toBeDefined();
    expect(hit).toMatchObject({
      operation: 'pin_rate_limit',
      outcome: 'hit',
      group_id: 'g1',
      user_id: 'u1',
      level: 'warn',
    });
  });

  it('emits a structured pin_rate_limit log line on reset (NFR-3)', () => {
    recordPinFailure(args);
    const logSpy = vi.spyOn(console, 'log');
    logSpy.mockClear();

    resetPinRateLimit(args);
    const lines = logSpy.mock.calls
      .map((c) => c[0] as string)
      .filter((line) => typeof line === 'string')
      .map((line) => JSON.parse(line));
    const reset = lines.find(
      (l: { operation?: string; outcome?: string }) =>
        l.operation === 'pin_rate_limit' && l.outcome === 'reset',
    );
    expect(reset).toBeDefined();
    expect(reset).toMatchObject({
      operation: 'pin_rate_limit',
      outcome: 'reset',
      group_id: 'g1',
      user_id: 'u1',
      level: 'info',
    });
  });
});
