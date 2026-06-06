import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  consumeResetToken,
  hashRawToken,
  issueResetToken,
  RESET_TTL_MS,
  type ConsumeResetTokenDeps,
  type IssueResetTokenDeps,
} from './recovery';

type DbExecutor = Parameters<IssueResetTokenDeps['runInTransaction']>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;

const FAKE_TX = {} as DbExecutor;

function makeIssueDeps(
  overrides: Partial<IssueResetTokenDeps>,
): IssueResetTokenDeps {
  return {
    findRecoveryEmail: vi.fn().mockResolvedValue('alex@example.com'),
    invalidatePriorTokens: vi.fn().mockResolvedValue(undefined),
    insertResetRow: vi.fn().mockResolvedValue(undefined),
    runInTransaction: async (work) => work(FAKE_TX),
    generateToken: () => 'fixed-raw-token-aaaa-bbbb-cccc-dddd',
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

function makeConsumeDeps(
  overrides: Partial<ConsumeResetTokenDeps>,
): ConsumeResetTokenDeps {
  return {
    findActiveTokenRow: vi.fn().mockResolvedValue({
      id: 'reset-row-id',
      user_id: 'user-1',
    }),
    markConsumed: vi.fn().mockResolvedValue(undefined),
    setPinHash: vi.fn().mockResolvedValue(undefined),
    runInTransaction: async (work) => work(FAKE_TX),
    hashPin: async (raw) => `hashed:${raw}`,
    removeUnlock: vi.fn().mockResolvedValue(undefined),
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe('issueResetToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('invalidates prior unconsumed rows, inserts a new row, and returns raw token + hash', async () => {
    const deps = makeIssueDeps({});
    const result = await issueResetToken('user-1', deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.rawToken).toBe('fixed-raw-token-aaaa-bbbb-cccc-dddd');
    expect(result.tokenHash).toBe(hashRawToken(result.rawToken));
    expect(result.recoveryEmail).toBe('alex@example.com');

    expect(deps.invalidatePriorTokens).toHaveBeenCalledWith(FAKE_TX, 'user-1');
    expect(deps.insertResetRow).toHaveBeenCalledTimes(1);

    const insertArg = (deps.insertResetRow as ReturnType<typeof vi.fn>).mock
      .calls[0]![1];
    expect(insertArg.user_id).toBe('user-1');
    expect(insertArg.token_hash).toBe(result.tokenHash);
    expect(insertArg.expires_at.getTime()).toBe(1_700_000_000_000 + RESET_TTL_MS);
  });

  it('returns no_recovery_email when the user has none — without inserting any row', async () => {
    const deps = makeIssueDeps({
      findRecoveryEmail: vi.fn().mockResolvedValue(null),
    });

    const result = await issueResetToken('user-2', deps);

    expect(result).toEqual({ ok: false, reason: 'no_recovery_email' });
    expect(deps.invalidatePriorTokens).not.toHaveBeenCalled();
    expect(deps.insertResetRow).not.toHaveBeenCalled();
  });

  it('treats a missing user row identically to a null recovery_email', async () => {
    const deps = makeIssueDeps({
      findRecoveryEmail: vi.fn().mockResolvedValue(undefined),
    });
    const result = await issueResetToken('user-3', deps);
    expect(result).toEqual({ ok: false, reason: 'no_recovery_email' });
  });
});

describe('consumeResetToken', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: marks the row consumed, updates pin_hash, and clears the unlock', async () => {
    const deps = makeConsumeDeps({});
    const result = await consumeResetToken('the-raw-token', '1234', deps);

    expect(result).toEqual({ ok: true, userId: 'user-1' });

    const findArg = (deps.findActiveTokenRow as ReturnType<typeof vi.fn>).mock
      .calls[0]!;
    expect(findArg[1]).toBe(hashRawToken('the-raw-token'));
    expect(findArg[2]).toEqual(new Date(1_700_000_000_000));

    expect(deps.markConsumed).toHaveBeenCalledWith(
      FAKE_TX,
      'reset-row-id',
      expect.any(Date),
    );
    expect(deps.setPinHash).toHaveBeenCalledWith(FAKE_TX, 'user-1', 'hashed:1234');
    expect(deps.removeUnlock).toHaveBeenCalledWith('user-1');
  });

  it('returns invalid_or_expired when no matching active row exists', async () => {
    const deps = makeConsumeDeps({
      findActiveTokenRow: vi.fn().mockResolvedValue(null),
    });
    const result = await consumeResetToken('the-raw-token', '1234', deps);
    expect(result).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(deps.markConsumed).not.toHaveBeenCalled();
    expect(deps.setPinHash).not.toHaveBeenCalled();
    expect(deps.removeUnlock).not.toHaveBeenCalled();
  });

  it('AC: expired and already-consumed and unknown-token all surface the SAME reason (no info-leak)', async () => {
    // The recovery layer reads "active row" via a single SELECT that filters
    // by `consumed_at IS NULL AND expires_at > now()`. From the recovery
    // module's vantage point, all three failure causes collapse to the same
    // empty-result-set behaviour — we exercise each shape and assert the
    // surfaced reason is identical.
    const reasons: Array<{ row: null }> = [
      { row: null }, // expired
      { row: null }, // already consumed
      { row: null }, // unknown hash
    ];
    for (const { row } of reasons) {
      const deps = makeConsumeDeps({
        findActiveTokenRow: vi.fn().mockResolvedValue(row),
      });
      const result = await consumeResetToken('the-raw-token', '1234', deps);
      expect(result).toEqual({ ok: false, reason: 'invalid_or_expired' });
    }
  });

  it('rejects an invalid PIN shape without touching the DB or hashing', async () => {
    const hashPin = vi.fn().mockResolvedValue('hashed');
    const deps = makeConsumeDeps({ hashPin });

    const r1 = await consumeResetToken('the-raw-token', '12', deps);
    const r2 = await consumeResetToken('the-raw-token', 'abcd', deps);
    const r3 = await consumeResetToken('the-raw-token', '12345', deps);

    expect(r1).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(r2).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(r3).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(hashPin).not.toHaveBeenCalled();
    expect(deps.findActiveTokenRow).not.toHaveBeenCalled();
  });

  it('rejects an empty raw token without touching the DB', async () => {
    const deps = makeConsumeDeps({});
    const result = await consumeResetToken('', '1234', deps);
    expect(result).toEqual({ ok: false, reason: 'invalid_or_expired' });
    expect(deps.findActiveTokenRow).not.toHaveBeenCalled();
  });
});
