import { describe, expect, it } from 'vitest';
import { createFootballDataOrgProvider, normaliseMatch } from './football-data-org';
import { FeedFetchError } from './types';

function makeResponse(opts: {
  status?: number;
  body?: unknown;
  remainingMinute?: string | null;
}): Response {
  const headers = new Headers();
  if (opts.remainingMinute !== null && opts.remainingMinute !== undefined) {
    headers.set('X-Requests-Available-Minute', opts.remainingMinute);
  }
  const init: ResponseInit = { status: opts.status ?? 200, headers };
  const body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? {});
  return new Response(body, init);
}

describe('normaliseMatch', () => {
  it('maps a finished group-stage match', () => {
    const out = normaliseMatch({
      id: 12345,
      utcDate: '2026-06-11T20:00:00Z',
      status: 'FINISHED',
      homeTeam: { tla: 'USA' },
      awayTeam: { tla: 'MEX' },
      score: { duration: 'REGULAR', fullTime: { home: 2, away: 1 } },
    });
    expect(out).toEqual({
      match_id: '12345',
      team_home_code: 'USA',
      team_away_code: 'MEX',
      kickoff_at: '2026-06-11T20:00:00Z',
      final_status: 'FINISHED',
      finish_type: 'NORMAL_TIME',
      score_home: 2,
      score_away: 1,
    });
  });

  it('maps a penalty-shootout knockout match', () => {
    const out = normaliseMatch({
      id: 9001,
      utcDate: '2026-07-15T20:00:00Z',
      status: 'FINISHED',
      homeTeam: { tla: 'ARG' },
      awayTeam: { tla: 'BRA' },
      score: { duration: 'PENALTY_SHOOTOUT', fullTime: { home: 3, away: 2 } },
    });
    expect(out?.finish_type).toBe('PENALTIES');
    expect(out?.final_status).toBe('FINISHED');
  });

  it('returns null for an unknown status', () => {
    const out = normaliseMatch({
      id: 1,
      utcDate: '2026-06-11T20:00:00Z',
      status: 'WTF' as unknown as string,
      homeTeam: null,
      awayTeam: null,
      score: null,
    });
    expect(out).toBeNull();
  });

  it('handles missing scores (scheduled match)', () => {
    const out = normaliseMatch({
      id: 2,
      utcDate: '2026-06-11T20:00:00Z',
      status: 'TIMED',
      homeTeam: { tla: 'GER' },
      awayTeam: { tla: 'ITA' },
      score: { duration: 'REGULAR', fullTime: { home: null, away: null } },
    });
    expect(out?.score_home).toBeNull();
    expect(out?.score_away).toBeNull();
    expect(out?.final_status).toBe('TIMED');
    expect(out?.finish_type).toBe('NORMAL_TIME');
  });
});

describe('createFootballDataOrgProvider', () => {
  it('fetches and normalises matches with rate-limit header', async () => {
    const fetcher = async () =>
      makeResponse({
        body: {
          matches: [
            {
              id: 100,
              utcDate: '2026-06-11T20:00:00Z',
              status: 'FINISHED',
              homeTeam: { tla: 'USA' },
              awayTeam: { tla: 'CAN' },
              score: { duration: 'REGULAR', fullTime: { home: 1, away: 0 } },
            },
            // dropped: unknown status
            {
              id: 101,
              utcDate: '2026-06-11T23:00:00Z',
              status: 'GARBAGE',
              homeTeam: { tla: 'X' },
              awayTeam: { tla: 'Y' },
              score: null,
            },
          ],
        },
        remainingMinute: '7',
      });
    const provider = createFootballDataOrgProvider({
      apiKey: 'k',
      baseUrl: 'https://example.test',
      fetcher: fetcher as unknown as typeof fetch,
    });
    const out = await provider.fetchTournamentMatches({ competitionCode: 'WC' });
    expect(out.matches).toHaveLength(1);
    expect(out.matches[0].match_id).toBe('100');
    expect(out.rate_limit.remaining_minute).toBe(7);
  });

  it('sends X-Auth-Token and hits the right URL', async () => {
    const calls: Array<{ url: string; headers: Headers }> = [];
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), headers: new Headers(init?.headers) });
      return makeResponse({ body: { matches: [] }, remainingMinute: '10' });
    };
    const provider = createFootballDataOrgProvider({
      apiKey: 'secret',
      baseUrl: 'https://api.example.test/',
      fetcher: fetcher as unknown as typeof fetch,
    });
    await provider.fetchTournamentMatches({ competitionCode: 'WC' });
    expect(calls[0].url).toBe('https://api.example.test/v4/competitions/WC/matches');
    expect(calls[0].headers.get('X-Auth-Token')).toBe('secret');
  });

  it('throws FeedFetchError on non-2xx', async () => {
    const fetcher = async () => makeResponse({ status: 500, body: 'oops' });
    const provider = createFootballDataOrgProvider({
      apiKey: 'k',
      fetcher: fetcher as unknown as typeof fetch,
    });
    await expect(
      provider.fetchTournamentMatches({ competitionCode: 'WC' }),
    ).rejects.toMatchObject({ name: 'FeedFetchError', status: 500, rate_limited: false });
  });

  it('flags rate-limited on 429', async () => {
    const fetcher = async () => makeResponse({ status: 429, body: 'slow down' });
    const provider = createFootballDataOrgProvider({
      apiKey: 'k',
      fetcher: fetcher as unknown as typeof fetch,
    });
    await expect(
      provider.fetchTournamentMatches({ competitionCode: 'WC' }),
    ).rejects.toMatchObject({ name: 'FeedFetchError', status: 429, rate_limited: true });
  });

  it('returns null remaining_minute when header is absent', async () => {
    const fetcher = async () => makeResponse({ body: { matches: [] }, remainingMinute: null });
    const provider = createFootballDataOrgProvider({
      apiKey: 'k',
      fetcher: fetcher as unknown as typeof fetch,
    });
    const out = await provider.fetchTournamentMatches({ competitionCode: 'WC' });
    expect(out.rate_limit.remaining_minute).toBeNull();
  });
});

describe('FeedFetchError', () => {
  it('exposes status, rate_limited, body_excerpt', () => {
    const err = new FeedFetchError({ status: 429, body_excerpt: 'x', rate_limited: true });
    expect(err.status).toBe(429);
    expect(err.rate_limited).toBe(true);
    expect(err.body_excerpt).toBe('x');
  });
});
