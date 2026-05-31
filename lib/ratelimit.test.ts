import { beforeEach, describe, expect, it } from 'vitest';
import {
  LIMIT,
  MAX_TRACKED_IPS,
  WINDOW_MS,
  _clearForTests,
  increment,
  peek,
  reset,
} from './ratelimit';

describe('ratelimit', () => {
  beforeEach(() => {
    _clearForTests();
  });

  it('starts under the limit for a fresh IP', () => {
    expect(peek('1.1.1.1')).toBe(false);
  });

  it('blocks the sixth attempt within the window', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < LIMIT; i += 1) {
      increment('1.1.1.1', now + i);
    }
    expect(peek('1.1.1.1', now + LIMIT)).toBe(true);
  });

  it('does not block attempts from a different IP', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < LIMIT; i += 1) {
      increment('1.1.1.1', now + i);
    }
    expect(peek('2.2.2.2', now + LIMIT)).toBe(false);
  });

  it('forgets entries older than the window', () => {
    const t0 = 1_700_000_000_000;
    for (let i = 0; i < LIMIT; i += 1) {
      increment('1.1.1.1', t0 + i);
    }
    expect(peek('1.1.1.1', t0 + LIMIT)).toBe(true);
    expect(peek('1.1.1.1', t0 + WINDOW_MS + 1)).toBe(false);
  });

  it('reset clears the bucket for an IP', () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < LIMIT; i += 1) {
      increment('1.1.1.1', now + i);
    }
    expect(peek('1.1.1.1', now + LIMIT)).toBe(true);
    reset('1.1.1.1');
    expect(peek('1.1.1.1', now + LIMIT)).toBe(false);
  });

  it('reset on a never-seen IP is a no-op', () => {
    reset('3.3.3.3');
    expect(peek('3.3.3.3')).toBe(false);
  });

  it('evicts the least-recently-touched IP when the LRU cap is exceeded', () => {
    const now = 1_700_000_000_000;
    // Fill to the cap.
    for (let i = 0; i < MAX_TRACKED_IPS; i += 1) {
      increment(`ip-${i}`, now + i);
    }
    // Touching the very first IP again should refresh it and keep it alive.
    increment('ip-0', now + MAX_TRACKED_IPS);
    // One more new IP pushes us over — the oldest *not-recently-touched* IP
    // (ip-1) should be evicted, ip-0 should survive.
    increment('overflow', now + MAX_TRACKED_IPS + 1);

    // ip-0 still tracked (peek returns false because below LIMIT but the
    // bucket was kept; verify by making it reach the limit cheaply).
    for (let i = 0; i < LIMIT - 1; i += 1) {
      increment('ip-0', now + MAX_TRACKED_IPS + 2 + i);
    }
    expect(peek('ip-0', now + MAX_TRACKED_IPS + 2 + LIMIT)).toBe(true);

    // ip-1 was evicted; a fresh attempt starts from zero.
    for (let i = 0; i < LIMIT - 1; i += 1) {
      increment('ip-1', now + MAX_TRACKED_IPS + 10 + i);
    }
    expect(peek('ip-1', now + MAX_TRACKED_IPS + 10 + LIMIT)).toBe(false);
  });
});
