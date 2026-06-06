/**
 * E03 S02 — R-4 enumeration test.
 *
 * Mitigates architecture risk R-4: a new prediction-write Server Action lands
 * without the PIN guard. The test imports every known prediction-write action,
 * mocks the world to put each one inside its happy-path AFTER the stage gate,
 * and asserts the action returns `{ error: 'pin_required' }` — i.e. that
 * `assertEditAllowedForUser` is called AFTER `isStageOpen` and BEFORE any DB
 * write.
 *
 * If a future action skips integrating the guard, this test fails because:
 *   - the action either bypasses the mocked guard (so no `pin_required`), or
 *   - the action proceeds to do DB work, which is not mocked here, so it
 *     throws — the spy below records that.
 *
 * Adding a new prediction-write action to the codebase MUST also extend the
 * `cases` array below.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// --- Module mocks (must be declared BEFORE importing the actions) -----------

// Session: always authenticated.
vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { group_id: 'g-test', username: 'group' } }),
}));

// Current user cookie: always identifies the same PIN-protected user.
vi.mock('@/lib/current-user', () => ({
  getCurrentUserId: async () => 'u-pin-protected',
  requireCurrentUserId: async () => 'u-pin-protected',
}));

// Stage gate: always open. The PIN guard must sit AFTER this.
vi.mock('@/lib/stages/is-stage-open', () => ({
  isStageOpen: async () => ({ open: true }),
}));

// Current tournament: any string is fine; nothing should reach the DB.
vi.mock('@/lib/tournaments/current', () => ({
  getCurrentTournamentId: async () => 't-test',
  resolveTournamentCode: () => 'WC2026',
  resolveCurrentTournamentId: async () => 't-test',
}));

// The PIN guard: returns the pin_required outcome a real PIN-protected user
// with no unlock cookie would produce. If an action forgets to call this, the
// action will proceed past us to DB land (which is not mocked) and crash —
// the test will fail loud either way.
const assertEditAllowedForUserSpy = vi.fn();
vi.mock('@/lib/pin/guard', () => ({
  assertEditAllowedForUser: (args: unknown) => assertEditAllowedForUserSpy(args),
}));

// The DB: every call is a hard fail so we can detect "the action skipped the
// guard and proceeded to DB". Drizzle's chain calls are not mocked here on
// purpose — the chain throws on first access and we record it.
const dbCallSpy = vi.fn();
vi.mock('@/lib/db', () => {
  const trap = (path: string) =>
    new Proxy(() => undefined, {
      get(_t, prop: string) {
        return trap(`${path}.${prop}`);
      },
      apply() {
        dbCallSpy(path);
        throw new Error(`db.${path}() called — action skipped the PIN guard`);
      },
    });
  return { db: trap('db') };
});

// --- Now import the actions under test (after the mocks above) --------------

import { saveGroupStagePick } from '@/app/predict/group-stage/actions';
import { saveTriviaAnswer } from '@/app/predict/trivia/actions';
import { toggleBestThirdsLetter } from '@/app/predict/best-thirds/actions';
import { saveFinalSlot } from '@/app/predict/final/actions';
import { saveKnockoutPick } from '@/app/predict/knockout/[round]/actions';

interface ActionCase {
  name: string;
  invoke: () => Promise<{ error?: string }>;
}

const cases: ActionCase[] = [
  {
    name: 'saveGroupStagePick',
    invoke: () => saveGroupStagePick('game-1', '1A'),
  },
  {
    name: 'saveTriviaAnswer',
    invoke: () => saveTriviaAnswer(1, 'placeholder'),
  },
  {
    name: 'toggleBestThirdsLetter',
    invoke: () => toggleBestThirdsLetter('A', true),
  },
  {
    name: 'saveFinalSlot',
    invoke: () => saveFinalSlot('F1', 't-1'),
  },
  {
    name: 'saveKnockoutPick',
    invoke: () => saveKnockoutPick('r16', 'game-1', '1A'),
  },
];

describe('R-4 — every prediction-write action runs through the PIN guard', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    assertEditAllowedForUserSpy.mockReset();
    assertEditAllowedForUserSpy.mockResolvedValue({
      ok: false,
      reason: 'pin_required',
    });
    dbCallSpy.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Hard list — covers the entire prediction-write surface. If a new action
  // lands without an entry here, the maintainer must update both the
  // integration and this enumeration.
  it('covers exactly the documented set of actions', () => {
    expect(cases.map((c) => c.name).sort()).toEqual(
      [
        'saveGroupStagePick',
        'saveTriviaAnswer',
        'toggleBestThirdsLetter',
        'saveFinalSlot',
        'saveKnockoutPick',
      ].sort(),
    );
  });

  for (const c of cases) {
    it(`${c.name}: returns pin_required and never reaches the DB`, async () => {
      const result = await c.invoke();
      expect(result.error).toBe('pin_required');
      expect(assertEditAllowedForUserSpy).toHaveBeenCalledTimes(1);
      expect(assertEditAllowedForUserSpy).toHaveBeenCalledWith({
        groupId: 'g-test',
        userId: 'u-pin-protected',
      });
      expect(dbCallSpy).not.toHaveBeenCalled();
    });
  }
});
