import { describe, expect, it, vi } from 'vitest';
import { getHomeData, type HomeDataDeps } from './home-data';

function makeDeps(overrides: Partial<HomeDataDeps> = {}): HomeDataDeps {
  const base: HomeDataDeps = {
    loadPlayerName: vi.fn(async () => 'Mart'),
    loadOpenStages: vi.fn(async () => []),
    loadStageProgress: vi.fn(async () => ({
      submitted: 0,
      expected: 8,
      unit: 'valitud' as const,
    })),
    isFinalEnded: vi.fn(async () => false),
    loadCurrentScore: vi.fn(async () => ({ totalPoints: 0, position: null })),
    loadLegacyPreview: vi.fn(async () => []),
    loadCrossTournamentPreview: vi.fn(async () => []),
  };
  return { ...base, ...overrides };
}

const INPUT = {
  userId: 'u1',
  groupId: 'g1',
  groupName: 'Pohlamarjad',
  tournamentId: 't1',
};

describe('getHomeData', () => {
  it('returns empty open-windows and empty previews on a fresh portal', async () => {
    const out = await getHomeData(INPUT, makeDeps());
    expect(out.greeting).toEqual({ playerName: 'Mart', groupName: 'Pohlamarjad' });
    expect(out.openWindows).toEqual([]);
    expect(out.roastUnlocked).toBe(false);
    expect(out.currentScore).toEqual({ totalPoints: 0, position: null });
    expect(out.legacyPreview).toEqual([]);
    expect(out.crossTournamentPreview).toEqual([]);
  });

  it('builds open-window cards with labels, CTAs, and progress strings', async () => {
    const out = await getHomeData(
      INPUT,
      makeDeps({
        loadOpenStages: vi.fn(async () => [
          {
            code: 'best_thirds' as const,
            position: 3,
            opens_at: new Date('2026-06-25T18:00:00Z'),
            closes_at: new Date('2026-06-26T18:00:00Z'),
          },
        ]),
        loadStageProgress: vi.fn(async () => ({
          submitted: 5,
          expected: 8,
          unit: 'valitud' as const,
        })),
      }),
    );

    expect(out.openWindows).toHaveLength(1);
    const card = out.openWindows[0]!;
    expect(card.code).toBe('best_thirds');
    expect(card.labelEt).toBe('8 parima kolmanda valik');
    expect(card.ctaHref).toBe('/predict/best-thirds');
    expect(card.progressLabel).toBe('5 / 8 valitud');
  });

  it('surfaces roastUnlocked from isFinalEnded', async () => {
    const out = await getHomeData(INPUT, makeDeps({ isFinalEnded: vi.fn(async () => true) }));
    expect(out.roastUnlocked).toBe(true);
  });

  it('passes through legacy preview rows in their query order', async () => {
    const rows = [
      {
        tournamentName: 'EM 2024',
        tournamentCode: 'EM2024',
        totalPoints: 87,
        finishingPosition: 2,
      },
      {
        tournamentName: 'EM 2020',
        tournamentCode: 'EM2020',
        totalPoints: 64,
        finishingPosition: 3,
      },
    ];
    const out = await getHomeData(
      INPUT,
      makeDeps({ loadLegacyPreview: vi.fn(async () => rows) }),
    );
    expect(out.legacyPreview).toEqual(rows);
  });

  it('passes through cross-tournament preview rows', async () => {
    const rows = [
      { userId: 'u-jaan', username: 'Jaan', totalPoints: 492 },
      { userId: 'u-mart', username: 'Mart', totalPoints: 478 },
    ];
    const out = await getHomeData(
      INPUT,
      makeDeps({ loadCrossTournamentPreview: vi.fn(async () => rows) }),
    );
    expect(out.crossTournamentPreview).toEqual(rows);
  });

  it('reports the resolved current score row from v_user_points', async () => {
    const out = await getHomeData(
      INPUT,
      makeDeps({
        loadCurrentScore: vi.fn(async () => ({ totalPoints: 34, position: 4 })),
      }),
    );
    expect(out.currentScore).toEqual({ totalPoints: 34, position: 4 });
  });
});
