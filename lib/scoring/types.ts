// Legacy result codes used throughout the prediction surfaces.
// In group-stage interpretation (this S03 scope):
//   '1A' = home team wins by 1-2 goals (narrow)
//   '1B' = home team wins by >=3 goals (wide)
//   '2A' = away team wins by 1-2 goals (narrow)
//   '2B' = away team wins by >=3 goals (wide)
//   'X'  = draw
// Knockout interpretation lands in S08 alongside team-score.ts.
export type ResultCode = '1A' | '1B' | '2A' | '2B' | 'X';

// Provider-agnostic feed match shape. The football-data.org adapter (S18)
// is responsible for normalising provider responses into this shape.
export type FeedStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'SUSPENDED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'AWARDED';

export interface FeedMatch {
  homeScore: number;
  awayScore: number;
  status: FeedStatus;
}

export type NonResultReason =
  | 'NOT_FINAL'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED';

export type MapResultOutcome =
  | { kind: 'result'; code: ResultCode }
  | { kind: 'no-result'; reason: NonResultReason };
