import { describe, expect, it, vi } from 'vitest';
import { formatProgress, getStageProgress, type GetStageProgressDeps } from './progress';

function makeDeps(overrides: Partial<GetStageProgressDeps> = {}): GetStageProgressDeps {
  return {
    countUserGamesGroupStage: vi.fn(async () => 0),
    countGroupStageGames: vi.fn(async () => 0),
    countUserBestThirds: vi.fn(async () => 0),
    countUserTeams: vi.fn(async () => 0),
    countUserTrivia: vi.fn(async () => 0),
    countTriviaQuestions: vi.fn(async () => 0),
    ...overrides,
  };
}

describe('formatProgress', () => {
  it('formats with unit label', () => {
    expect(formatProgress({ submitted: 12, expected: 72, unit: 'esitatud' })).toBe(
      '12 / 72 esitatud',
    );
    expect(formatProgress({ submitted: 5, expected: 8, unit: 'valitud' })).toBe(
      '5 / 8 valitud',
    );
  });
});

describe('getStageProgress', () => {
  it('group_matches: reads user_games count vs games count', async () => {
    const deps = makeDeps({
      countUserGamesGroupStage: vi.fn(async () => 12),
      countGroupStageGames: vi.fn(async () => 72),
    });
    const out = await getStageProgress('group_matches', 'u1', 't1', deps);
    expect(out).toEqual({ submitted: 12, expected: 72, unit: 'esitatud' });
    expect(deps.countUserGamesGroupStage).toHaveBeenCalledWith('u1', 't1');
    expect(deps.countGroupStageGames).toHaveBeenCalledWith('t1');
  });

  it('best_thirds: expected is the constant 8', async () => {
    const out = await getStageProgress(
      'best_thirds',
      'u1',
      't1',
      makeDeps({ countUserBestThirds: vi.fn(async () => 5) }),
    );
    expect(out).toEqual({ submitted: 5, expected: 8, unit: 'valitud' });
  });

  it('knockout rounds use the right round filter and expected count', async () => {
    const countUserTeams = vi.fn(async () => 3);
    const cases = [
      { code: 'r32', expected: 16 },
      { code: 'r16', expected: 8 },
      { code: 'qf', expected: 4 },
      { code: 'sf', expected: 2 },
    ] as const;
    for (const c of cases) {
      const out = await getStageProgress(c.code, 'u1', 't1', makeDeps({ countUserTeams }));
      expect(out).toEqual({ submitted: 3, expected: c.expected, unit: 'esitatud' });
      expect(countUserTeams).toHaveBeenCalledWith('u1', 't1', c.code);
    }
  });

  it('final: expected = 4 and round filter = final', async () => {
    const countUserTeams = vi.fn(async () => 2);
    const out = await getStageProgress('final', 'u1', 't1', makeDeps({ countUserTeams }));
    expect(out).toEqual({ submitted: 2, expected: 4, unit: 'valitud' });
    expect(countUserTeams).toHaveBeenCalledWith('u1', 't1', 'final');
  });

  it('trivia: reads user_questions count vs questions count', async () => {
    const out = await getStageProgress(
      'trivia',
      'u1',
      't1',
      makeDeps({
        countUserTrivia: vi.fn(async () => 3),
        countTriviaQuestions: vi.fn(async () => 5),
      }),
    );
    expect(out).toEqual({ submitted: 3, expected: 5, unit: 'vastatud' });
  });
});
