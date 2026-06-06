import type { GameSeed, TournamentSeed } from './wc2026';

export type StageSeed = {
  code: 'trivia' | 'group_matches' | 'best_thirds' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  position: number;
  opensAt: string;
  closesAt: string;
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FOUR_HOURS_MS = 4 * HOUR_MS;
const THIRTY_DAYS_MS = 30 * DAY_MS;

function minKickoff(games: GameSeed[], stage: GameSeed['stageCode']): Date {
  const matches = games.filter((g) => g.stageCode === stage);
  if (matches.length === 0) {
    throw new Error(`No games found for stage ${stage}`);
  }
  return new Date(Math.min(...matches.map((g) => new Date(g.kickoffAt).getTime())));
}

/**
 * Earliest kickoff among group-stage matches on a given matchday (1, 2, or 3).
 * Round labels follow `{letter}{md}-{pair}` (e.g. "A2-1" → matchday 2).
 */
function minGroupMatchdayKickoff(games: GameSeed[], matchday: 1 | 2 | 3): Date {
  const matches = games.filter((g) => {
    if (g.stageCode !== 'group_matches') return false;
    const mdChar = g.roundLabel.charAt(1);
    return Number(mdChar) === matchday;
  });
  if (matches.length === 0) {
    throw new Error(`No group-stage matches found for matchday ${matchday}`);
  }
  return new Date(Math.min(...matches.map((g) => new Date(g.kickoffAt).getTime())));
}

function maxKickoff(games: GameSeed[], stage: GameSeed['stageCode']): Date {
  const matches = games.filter((g) => g.stageCode === stage);
  if (matches.length === 0) {
    throw new Error(`No games found for stage ${stage}`);
  }
  return new Date(Math.max(...matches.map((g) => new Date(g.kickoffAt).getTime())));
}

/**
 * Derive stage windows from the seeded game schedule.
 *
 * Principle: each stage opens once all its participants are knowable, and
 * closes at the exact kickoff that locks the prediction.
 *
 * `trivia`, `group_matches`, `best_thirds`, and `final` are "always open" —
 * each lets players record early picks (medal-position predictions in the
 * `final` case) and only locks at the relevant kickoff. opens_at is set to a
 * sentinel well before the tournament (tournament.startsAt - 30d) since the
 * column is NOT NULL. As semifinals are decided the finals picker narrows
 * its candidate list to the four semifinalists, but the window itself stays
 * open from day one.
 *
 * Closing rules:
 *  - `group_matches` closes at the FIRST MD1 kickoff (any group match
 *    starting locks every group-stage prediction; UX spec §9 Q4, S10 AC).
 *  - `trivia` and `best_thirds` close at the FIRST MD2 kickoff. Players get
 *    one matchday of signal — MD1 results are visible before locking trivia
 *    answers and best-thirds picks — but can't wait until late group stage
 *    when the actual third-placed standings are largely knowable, which
 *    would erode the prediction skill.
 *  - knockout stages (`r32`, `r16`, `qf`, `sf`) close at their first kickoff.
 *  - `final` (covers F1/F2/F3/F4 + 3rd-place) closes at the 3rd-place kickoff.
 */
export function deriveStages(tournament: TournamentSeed, games: GameSeed[]): StageSeed[] {
  const tournamentStart = new Date(tournament.startsAt);
  const alwaysOpen = new Date(tournamentStart.getTime() - THIRTY_DAYS_MS);

  const firstGroupMd1 = minGroupMatchdayKickoff(games, 1);
  const firstGroupMd2 = minGroupMatchdayKickoff(games, 2);
  const lastGroup = maxKickoff(games, 'group_matches');
  const firstR32 = minKickoff(games, 'r32');
  const lastR32 = maxKickoff(games, 'r32');
  const firstR16 = minKickoff(games, 'r16');
  const lastR16 = maxKickoff(games, 'r16');
  const firstQf = minKickoff(games, 'qf');
  const lastQf = maxKickoff(games, 'qf');
  const firstSf = minKickoff(games, 'sf');
  const firstFinal = minKickoff(games, 'final');

  const stages: StageSeed[] = [
    {
      code: 'trivia',
      position: 1,
      opensAt: alwaysOpen.toISOString(),
      closesAt: firstGroupMd2.toISOString(),
    },
    {
      code: 'group_matches',
      position: 2,
      opensAt: alwaysOpen.toISOString(),
      closesAt: firstGroupMd1.toISOString(),
    },
    {
      code: 'best_thirds',
      position: 3,
      opensAt: alwaysOpen.toISOString(),
      closesAt: firstGroupMd2.toISOString(),
    },
    {
      code: 'r32',
      position: 4,
      opensAt: new Date(lastGroup.getTime() + FOUR_HOURS_MS).toISOString(),
      closesAt: firstR32.toISOString(),
    },
    {
      code: 'r16',
      position: 5,
      opensAt: new Date(lastR32.getTime() + FOUR_HOURS_MS).toISOString(),
      closesAt: firstR16.toISOString(),
    },
    {
      code: 'qf',
      position: 6,
      opensAt: new Date(lastR16.getTime() + FOUR_HOURS_MS).toISOString(),
      closesAt: firstQf.toISOString(),
    },
    {
      code: 'sf',
      position: 7,
      opensAt: new Date(lastQf.getTime() + FOUR_HOURS_MS).toISOString(),
      closesAt: firstSf.toISOString(),
    },
    {
      code: 'final',
      position: 8,
      opensAt: alwaysOpen.toISOString(),
      closesAt: firstFinal.toISOString(),
    },
  ];

  return stages;
}
