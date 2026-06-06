/**
 * E03 S05 — Forgot-PIN recovery token issue / consume.
 *
 * Storage shape: `user_pin_resets` row carries the sha256 hash of the raw
 * token. The raw token is sent ONLY via email and only the user sees it.
 * Architecture D3 (single-use), I4 (no info-leak between "expired" and
 * "consumed"), NFR-5/6/7 (no raw token, no raw PIN, no unmasked email in logs),
 * R-1 (rate-limit on user_pin_resets via the issuance flow's invalidation step).
 *
 * Invariants:
 *  1. At most one live (unconsumed + unexpired) token per user. Issuing a new
 *     one atomically marks all prior unconsumed rows consumed.
 *  2. Consume verifies token_hash, consumed_at IS NULL, expires_at > now() in
 *     one SELECT. All three failure modes (not found / consumed / expired)
 *     collapse to a single opaque `invalid_or_expired` reason.
 *  3. Consume updates the reset row AND `users.pin_hash` inside ONE
 *     `db.transaction()` so we can never end up with a consumed token and the
 *     old PIN, or a live token and the new PIN.
 *  4. Raw PIN/token values are never logged. Recovery-email surfaces in logs
 *     only via `maskEmail`.
 */
import { randomBytes, createHash } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';

import { db as defaultDb } from '@/lib/db';
import { log } from '@/lib/log';
import { removeUnlock as defaultRemoveUnlock } from '@/lib/pin/cookie';
import { hashPin as defaultHashPin } from '@/lib/pin/hash';
import { maskEmail } from '@/lib/pin/mask-email';
import { isValidPin } from '@/lib/pin/validate';
import { user_pin_resets, users } from '@/db/schema';

/** 30 minutes — architecture D3. */
export const RESET_TTL_MS = 30 * 60 * 1000;

export interface IssueResetTokenOk {
  ok: true;
  rawToken: string;
  /** sha256 hex digest of `rawToken`, surfaced so callers can roll back a
   * specific row without re-deriving the hash on failure. */
  tokenHash: string;
  /** Recipient address to drive the email send. Caller is responsible for not
   * forwarding this to logs in unmasked form. */
  recoveryEmail: string;
}
export interface IssueResetTokenNoEmail {
  ok: false;
  reason: 'no_recovery_email';
}
export type IssueResetTokenResult = IssueResetTokenOk | IssueResetTokenNoEmail;

export type ConsumeResetTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'invalid_or_expired' };

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function hashRawToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

function generateRawToken(): string {
  // 32 random bytes (256 bits) -> base64url ~ 43 chars. Sufficient entropy
  // that an online brute-force is infeasible inside the 30-min window per
  // architecture D3.
  return randomBytes(32).toString('base64url');
}

// ---------------------------------------------------------------------------
// DI seam
// ---------------------------------------------------------------------------

/**
 * Transaction-aware DB-executor type — same alias Drizzle yields inside
 * `db.transaction((tx) => ...)`. Reused from `lib/recompute/match.ts` style.
 */
type DbExecutor = Parameters<Parameters<typeof defaultDb.transaction>[0]>[0];

export interface IssueResetTokenDeps {
  /** Resolves to the user's recovery_email (null if not set, undefined if
   * the user row itself does not exist — both surface as no_recovery_email). */
  findRecoveryEmail: (userId: string) => Promise<string | null | undefined>;
  /** Marks every unconsumed row for `userId` consumed inside the active txn. */
  invalidatePriorTokens: (tx: DbExecutor, userId: string) => Promise<void>;
  insertResetRow: (
    tx: DbExecutor,
    row: { user_id: string; token_hash: string; expires_at: Date },
  ) => Promise<void>;
  /** Wraps the work in a transaction. Default uses `db.transaction`. */
  runInTransaction: <T>(work: (tx: DbExecutor) => Promise<T>) => Promise<T>;
  /** Token-generation seam so tests can inject a deterministic raw token. */
  generateToken: () => string;
  now: () => number;
}

export interface ConsumeResetTokenDeps {
  /** Look up a single matching row (unconsumed AND unexpired at `now`). */
  findActiveTokenRow: (
    tx: DbExecutor,
    tokenHash: string,
    now: Date,
  ) => Promise<{ id: string; user_id: string } | null>;
  /** Mark the row consumed. */
  markConsumed: (tx: DbExecutor, rowId: string, now: Date) => Promise<void>;
  /** Persist the new PIN hash. */
  setPinHash: (tx: DbExecutor, userId: string, pinHash: string) => Promise<void>;
  runInTransaction: <T>(work: (tx: DbExecutor) => Promise<T>) => Promise<T>;
  hashPin: (raw: string) => Promise<string>;
  /** Remove the unlock cookie entry for the user (post-txn side-effect). */
  removeUnlock: (userId: string) => Promise<void>;
  now: () => number;
}

const defaultIssueDeps: IssueResetTokenDeps = {
  async findRecoveryEmail(userId) {
    const rows = await defaultDb
      .select({ recovery_email: users.recovery_email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0]?.recovery_email ?? null;
  },
  async invalidatePriorTokens(tx, userId) {
    await tx
      .update(user_pin_resets)
      .set({ consumed_at: new Date() })
      .where(
        and(
          eq(user_pin_resets.user_id, userId),
          isNull(user_pin_resets.consumed_at),
        ),
      );
  },
  async insertResetRow(tx, row) {
    await tx.insert(user_pin_resets).values(row);
  },
  runInTransaction(work) {
    return defaultDb.transaction(work);
  },
  generateToken: generateRawToken,
  now: () => Date.now(),
};

const defaultConsumeDeps: ConsumeResetTokenDeps = {
  async findActiveTokenRow(tx, tokenHash, now) {
    const rows = await tx
      .select({ id: user_pin_resets.id, user_id: user_pin_resets.user_id })
      .from(user_pin_resets)
      .where(
        and(
          eq(user_pin_resets.token_hash, tokenHash),
          isNull(user_pin_resets.consumed_at),
          gt(user_pin_resets.expires_at, now),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },
  async markConsumed(tx, rowId, now) {
    await tx
      .update(user_pin_resets)
      .set({ consumed_at: now })
      .where(eq(user_pin_resets.id, rowId));
  },
  async setPinHash(tx, userId, pinHash) {
    await tx.update(users).set({ pin_hash: pinHash }).where(eq(users.id, userId));
  },
  runInTransaction(work) {
    return defaultDb.transaction(work);
  },
  hashPin: defaultHashPin,
  removeUnlock: defaultRemoveUnlock,
  now: () => Date.now(),
};

// ---------------------------------------------------------------------------
// issue
// ---------------------------------------------------------------------------

/**
 * Issue a fresh reset token. Inside one transaction:
 *  1. Look up the user's recovery_email.
 *  2. If null → return `no_recovery_email`, no rows touched.
 *  3. Else: mark every prior unconsumed row for this user `consumed_at = now()`
 *     so no two live tokens ever exist for the same user.
 *  4. Generate a 256-bit raw token, sha256-hash it, insert a new row with
 *     `expires_at = now + 30 min`, `consumed_at = null`.
 *  5. Return the raw token + its hash + the recovery email.
 *
 * The raw token NEVER touches the database (only its hash does) and is
 * NEVER logged.
 */
export async function issueResetToken(
  userId: string,
  deps: IssueResetTokenDeps = defaultIssueDeps,
): Promise<IssueResetTokenResult> {
  const recoveryEmail = await deps.findRecoveryEmail(userId);
  if (!recoveryEmail) {
    log.info({
      operation: 'recovery_reset_issue',
      outcome: 'rejected',
      reason: 'no_recovery_email',
      user_id: userId,
    });
    return { ok: false, reason: 'no_recovery_email' };
  }

  const rawToken = deps.generateToken();
  const tokenHash = hashRawToken(rawToken);
  const nowMs = deps.now();
  const expiresAt = new Date(nowMs + RESET_TTL_MS);

  await deps.runInTransaction(async (tx) => {
    await deps.invalidatePriorTokens(tx, userId);
    await deps.insertResetRow(tx, {
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
  });

  log.info({
    operation: 'recovery_reset_issue',
    outcome: 'ok',
    user_id: userId,
    recovery_email_masked: maskEmail(recoveryEmail),
  });

  return { ok: true, rawToken, tokenHash, recoveryEmail };
}

// ---------------------------------------------------------------------------
// consume
// ---------------------------------------------------------------------------

/**
 * Consume a raw reset token: validate the new PIN, look up the matching row
 * (must be unconsumed and unexpired), then in ONE transaction mark the row
 * consumed and update `users.pin_hash`. Drops any unlock cookie entry for the
 * user as a post-commit side-effect.
 *
 * All three failure modes (token not found / already consumed / expired)
 * surface as the SAME opaque `invalid_or_expired` reason — per architecture
 * I4 / S05 AC the page must not leak which case applies.
 *
 * Invalid PIN shape also collapses to `invalid_or_expired` so a probe-based
 * attacker can't distinguish "token was good but PIN bad" from "token bad".
 */
export async function consumeResetToken(
  rawToken: string,
  newPin: string,
  deps: ConsumeResetTokenDeps = defaultConsumeDeps,
): Promise<ConsumeResetTokenResult> {
  if (!isValidPin(newPin)) {
    log.warn({
      operation: 'recovery_reset_consume',
      outcome: 'rejected',
      reason: 'invalid_or_expired',
    });
    return { ok: false, reason: 'invalid_or_expired' };
  }

  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    log.warn({
      operation: 'recovery_reset_consume',
      outcome: 'rejected',
      reason: 'invalid_or_expired',
    });
    return { ok: false, reason: 'invalid_or_expired' };
  }

  const tokenHash = hashRawToken(rawToken);
  const newPinHash = await deps.hashPin(newPin);
  const now = new Date(deps.now());

  let userId: string | null = null;
  await deps.runInTransaction(async (tx) => {
    const row = await deps.findActiveTokenRow(tx, tokenHash, now);
    if (!row) {
      // Stay inside the txn but record nothing; the outer code treats a null
      // userId as "not found OR expired OR already consumed".
      return;
    }
    await deps.markConsumed(tx, row.id, now);
    await deps.setPinHash(tx, row.user_id, newPinHash);
    userId = row.user_id;
  });

  if (userId === null) {
    log.warn({
      operation: 'recovery_reset_consume',
      outcome: 'rejected',
      reason: 'invalid_or_expired',
    });
    return { ok: false, reason: 'invalid_or_expired' };
  }

  await deps.removeUnlock(userId);

  log.info({
    operation: 'recovery_reset_consume',
    outcome: 'ok',
    user_id: userId,
  });

  return { ok: true, userId };
}

// ---------------------------------------------------------------------------
// Helper for masked-email plumbing into the PIN-entry modal.
// ---------------------------------------------------------------------------

/**
 * Returns the user's recovery email already masked, or null if none configured.
 * Used by Server Components that render the PIN-entry modal so the modal can
 * surface the "Forgot your PIN?" branch with the right hint.
 */
export async function getMaskedRecoveryEmailForUser(
  userId: string,
): Promise<string | null> {
  const rows = await defaultDb
    .select({ recovery_email: users.recovery_email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const email = rows[0]?.recovery_email;
  if (!email) return null;
  return maskEmail(email);
}

// ---------------------------------------------------------------------------
// Rollback helper used by the recovery request action when the email send
// fails. Marks a specific just-issued row consumed so the live token cannot
// be used.
// ---------------------------------------------------------------------------

export async function invalidateIssuedTokenByHash(
  tokenHash: string,
): Promise<void> {
  await defaultDb
    .update(user_pin_resets)
    .set({ consumed_at: new Date() })
    .where(eq(user_pin_resets.token_hash, tokenHash));
}
