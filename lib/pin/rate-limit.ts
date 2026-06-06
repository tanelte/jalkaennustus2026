/**
 * E03 S06 — PIN-entry rate-limit helper.
 *
 * Thin wrapper around the existing `lib/ratelimit.ts` token-bucket primitive,
 * keyed per (group_id, user_id), plus a structured `pin_rate_limit` log event
 * per NFR-3. Architecture D6: reuse the existing primitive; no permanent
 * lockout; soft limit 5 fails / 15 min; key shape `pin:{group_id}:{user_id}`.
 *
 * DI seam: tests inject in-memory rate-limit fns to keep the helper unit-
 * testable without sharing state with other tests in the same process.
 */
import {
  increment as defaultIncrement,
  peek as defaultPeek,
  reset as defaultReset,
} from '@/lib/ratelimit';
import { log } from '@/lib/log';

export interface PinRateLimitArgs {
  groupId: string;
  userId: string;
}

export interface PinRateLimitDeps {
  peek: (key: string, now?: number) => boolean;
  increment: (key: string, now?: number) => void;
  reset: (key: string) => void;
}

const defaultDeps: PinRateLimitDeps = {
  peek: defaultPeek,
  increment: defaultIncrement,
  reset: defaultReset,
};

export function pinRateLimitKey({ groupId, userId }: PinRateLimitArgs): string {
  return `pin:${groupId}:${userId}`;
}

/**
 * Returns true when the bucket is full — caller should short-circuit before
 * loading the hash or running bcrypt. Emits `pin_rate_limit` with outcome:
 * 'hit' so the audit trail captures the rejection.
 */
export function isPinRateLimited(
  args: PinRateLimitArgs,
  deps: PinRateLimitDeps = defaultDeps,
): boolean {
  const key = pinRateLimitKey(args);
  if (deps.peek(key)) {
    log.warn({
      operation: 'pin_rate_limit',
      outcome: 'hit',
      group_id: args.groupId,
      user_id: args.userId,
    });
    return true;
  }
  return false;
}

/**
 * Record a failed PIN attempt. The bucket is incremented even on attempt #5
 * (the one that *triggers* the limit) so the next call sees the limit.
 */
export function recordPinFailure(
  args: PinRateLimitArgs,
  deps: PinRateLimitDeps = defaultDeps,
): void {
  const key = pinRateLimitKey(args);
  deps.increment(key);
  log.info({
    operation: 'pin_rate_limit',
    outcome: 'allowed',
    group_id: args.groupId,
    user_id: args.userId,
  });
}

/**
 * Clear the bucket on a successful PIN entry. No permanent lockout (PRD non-
 * goal) — and a legitimate success is the strongest signal that the prior
 * failures were honest forgetfulness, not brute-force.
 */
export function resetPinRateLimit(
  args: PinRateLimitArgs,
  deps: PinRateLimitDeps = defaultDeps,
): void {
  const key = pinRateLimitKey(args);
  deps.reset(key);
  log.info({
    operation: 'pin_rate_limit',
    outcome: 'reset',
    group_id: args.groupId,
    user_id: args.userId,
  });
}
