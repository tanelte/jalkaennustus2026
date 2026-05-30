import { beforeEach, describe, expect, it } from 'vitest';
import { LIMIT, WINDOW_MS, _clearForTests, increment, peek, reset } from './ratelimit';

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
});
