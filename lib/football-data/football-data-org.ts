import type { FeedStatus, KnockoutFinishType } from '@/lib/scoring/types';
import {
  FeedFetchError,
  type FeedProvider,
  type FetchOutcome,
  type MatchResult,
} from './types';

type Fetcher = typeof fetch;

const VALID_FEED_STATUSES: ReadonlySet<string> = new Set([
  'SCHEDULED',
  'TIMED',
  'IN_PLAY',
  'PAUSED',
  'FINISHED',
  'SUSPENDED',
  'POSTPONED',
  'CANCELLED',
  'AWARDED',
]);

interface RawFootballDataMatch {
  id: number | string;
  utcDate: string;
  status: string;
  homeTeam?: { tla?: string | null } | null;
  awayTeam?: { tla?: string | null } | null;
  score?: {
    duration?: string | null;
    fullTime?: { home?: number | null; away?: number | null } | null;
  } | null;
}

interface RawFootballDataResponse {
  matches?: RawFootballDataMatch[];
}

function mapDurationToFinishType(duration: string | null | undefined): KnockoutFinishType | null {
  switch (duration) {
    case 'REGULAR':
    case 'REGULAR_TIME':
      return 'NORMAL_TIME';
    case 'EXTRA_TIME':
      return 'EXTRA_TIME';
    case 'PENALTY_SHOOTOUT':
      return 'PENALTIES';
    default:
      return null;
  }
}

function mapStatus(raw: string): FeedStatus | null {
  return VALID_FEED_STATUSES.has(raw) ? (raw as FeedStatus) : null;
}

export function normaliseMatch(raw: RawFootballDataMatch): MatchResult | null {
  const status = mapStatus(raw.status);
  if (!status) return null;

  const finishType = mapDurationToFinishType(raw.score?.duration ?? null);
  const scoreHome = raw.score?.fullTime?.home;
  const scoreAway = raw.score?.fullTime?.away;

  return {
    match_id: String(raw.id),
    team_home_code: raw.homeTeam?.tla ?? null,
    team_away_code: raw.awayTeam?.tla ?? null,
    kickoff_at: raw.utcDate,
    final_status: status,
    finish_type: finishType,
    score_home: typeof scoreHome === 'number' ? scoreHome : null,
    score_away: typeof scoreAway === 'number' ? scoreAway : null,
  };
}

function parseRemainingMinute(headers: Headers): number | null {
  const raw = headers.get('X-Requests-Available-Minute');
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export interface FootballDataOrgProviderOpts {
  apiKey: string;
  baseUrl?: string;
  fetcher?: Fetcher;
}

export function createFootballDataOrgProvider(
  opts: FootballDataOrgProviderOpts,
): FeedProvider {
  const baseUrl = (opts.baseUrl ?? 'https://api.football-data.org').replace(/\/$/, '');
  const fetcher = opts.fetcher ?? fetch;

  return {
    async fetchTournamentMatches({ competitionCode, signal }): Promise<FetchOutcome> {
      const url = `${baseUrl}/v4/competitions/${encodeURIComponent(competitionCode)}/matches`;
      const res = await fetcher(url, {
        headers: { 'X-Auth-Token': opts.apiKey },
        signal,
      });
      const remaining = parseRemainingMinute(res.headers);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new FeedFetchError({
          status: res.status,
          body_excerpt: body.slice(0, 200),
          rate_limited: res.status === 429,
        });
      }
      const json = (await res.json()) as RawFootballDataResponse;
      const matches: MatchResult[] = [];
      for (const raw of json.matches ?? []) {
        const m = normaliseMatch(raw);
        if (m) matches.push(m);
      }
      return {
        matches,
        rate_limit: { remaining_minute: remaining },
      };
    },
  };
}
