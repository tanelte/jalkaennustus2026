import { describe, expect, it, vi } from 'vitest';
import { resolveCurrentTournamentId, resolveTournamentCode } from './current';

describe('resolveTournamentCode', () => {
  it('defaults to WC2026 when env var unset', () => {
    expect(resolveTournamentCode({})).toBe('WC2026');
  });

  it('uses CURRENT_TOURNAMENT_CODE when set', () => {
    expect(resolveTournamentCode({ CURRENT_TOURNAMENT_CODE: 'EM2028' })).toBe('EM2028');
  });

  it('ignores empty string env var (falls back to default)', () => {
    expect(resolveTournamentCode({ CURRENT_TOURNAMENT_CODE: '' })).toBe('WC2026');
  });
});

describe('resolveCurrentTournamentId', () => {
  it('returns id from finder when row exists', async () => {
    const finder = vi.fn(async (code: string) => (code === 'WC2026' ? 't-1' : null));
    const id = await resolveCurrentTournamentId({ findTournamentIdByCode: finder });
    expect(id).toBe('t-1');
    expect(finder).toHaveBeenCalledWith('WC2026');
  });

  it('honours the override code', async () => {
    const finder = vi.fn(async (code: string) => (code === 'EM2028' ? 't-2' : null));
    const id = await resolveCurrentTournamentId({
      findTournamentIdByCode: finder,
      code: 'EM2028',
    });
    expect(id).toBe('t-2');
    expect(finder).toHaveBeenCalledWith('EM2028');
  });

  it('throws when no tournament row matches', async () => {
    const finder = vi.fn(async () => null);
    await expect(
      resolveCurrentTournamentId({ findTournamentIdByCode: finder }),
    ).rejects.toThrow(/No tournament found with code 'WC2026'/);
  });
});
