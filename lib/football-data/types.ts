import type { FeedStatus, KnockoutFinishType } from '@/lib/scoring/types';

/**
 * Provider-normalised match record. The football-data.org adapter (and any
 * future backup adapter) translates its raw response into this shape so the
 * orchestrator and the rest of the platform stay provider-agnostic.
 */
export interface MatchResult {
  match_id: string;
  team_home_code: string | null;
  team_away_code: string | null;
  kickoff_at: string;
  final_status: FeedStatus;
  finish_type: KnockoutFinishType | null;
  score_home: number | null;
  score_away: number | null;
}

export interface FetchOutcome {
  matches: MatchResult[];
  rate_limit: {
    remaining_minute: number | null;
  };
}

export interface FeedProvider {
  fetchTournamentMatches(opts: {
    competitionCode: string;
    signal?: AbortSignal;
  }): Promise<FetchOutcome>;
}

export class FeedFetchError extends Error {
  readonly status: number;
  readonly rate_limited: boolean;
  readonly body_excerpt: string;
  constructor(opts: { status: number; body_excerpt: string; rate_limited?: boolean }) {
    super(
      `football-data fetch failed: status=${opts.status}${opts.rate_limited ? ' (rate-limited)' : ''}`,
    );
    this.name = 'FeedFetchError';
    this.status = opts.status;
    this.rate_limited = opts.rate_limited ?? opts.status === 429;
    this.body_excerpt = opts.body_excerpt;
  }
}
