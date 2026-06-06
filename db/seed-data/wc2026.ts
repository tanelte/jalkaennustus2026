/**
 * Post-draw seed data for FIFA World Cup 2026.
 *
 * Source of truth: db/seed-data/wc2026-fixtures.json — a snapshot of the
 * football-data.org /v4/competitions/WC/matches payload (regenerate with
 * `pnpm tsx scripts/snapshot-wc2026-feed.ts` when the schedule changes).
 *
 * Teams, real group assignments, kick-off times, and group-stage / knockout
 * round_labels are derived from the snapshot. Estonian names live in the
 * teamNameEt dictionary below.
 *
 * Note on double_points: the rewrite intentionally seeds every match with
 * `doublePoints: false`. The operator flags the curated marquee set in DB
 * before kickoff via `scripts/update-double-points.ts`.
 */
import rawFeed from './wc2026-fixtures.json';

export type TournamentSeed = {
  code: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

export type TeamSeed = {
  code: string;
  nameEt: string;
  groupLetter: string;
};

export type GameSeed = {
  stageCode: 'group_matches' | 'r32' | 'r16' | 'qf' | 'sf' | 'final';
  roundLabel: string;
  kickoffAt: string;
  homeCode: string | null;
  awayCode: string | null;
  doublePoints: boolean;
};

export type QuestionSeed = {
  position: number;
  promptEt: string;
  answerShape: 'text' | 'integer' | 'team';
  conditionalOnPosition: number | null;
};

export const wc2026Tournament: TournamentSeed = {
  code: 'WC2026',
  name: 'FIFA World Cup 2026',
  startsAt: '2026-06-11T00:00:00Z',
  endsAt: '2026-07-19T23:59:59Z',
};

// Estonian display names for every team appearing in the feed snapshot.
// Codes are football-data.org TLAs (mostly ISO 3166-1 alpha-3, occasionally
// FIFA codes — e.g. RSA for South Africa, KSA for Saudi Arabia).
const teamNameEt: Record<string, string> = {
  // Africa
  ALG: 'Alžeeria',
  BIH: 'Bosnia ja Hertsegoviina', // (Europe; placed near top alphabetically below)
  CIV: 'Elevandiluurannik',
  CPV: 'Roheneemesaared',
  EGY: 'Egiptus',
  GHA: 'Ghana',
  MAR: 'Maroko',
  RSA: 'Lõuna-Aafrika Vabariik',
  SEN: 'Senegal',
  TUN: 'Tuneesia',
  COD: 'Kongo DV',
  // Asia / Oceania
  AUS: 'Austraalia',
  IRN: 'Iraan',
  IRQ: 'Iraak',
  JOR: 'Jordaania',
  JPN: 'Jaapan',
  KOR: 'Lõuna-Korea',
  KSA: 'Saudi Araabia',
  NZL: 'Uus-Meremaa',
  QAT: 'Katar',
  UZB: 'Usbekistan',
  // North / Central America & Caribbean
  CAN: 'Kanada',
  CUW: 'Curaçao',
  HAI: 'Haiti',
  MEX: 'Mehhiko',
  PAN: 'Panama',
  USA: 'Ameerika Ühendriigid',
  // South America
  ARG: 'Argentina',
  BRA: 'Brasiilia',
  COL: 'Colombia',
  ECU: 'Ecuador',
  PAR: 'Paraguay',
  URY: 'Uruguay',
  // Europe
  AUT: 'Austria',
  BEL: 'Belgia',
  CRO: 'Horvaatia',
  CZE: 'Tšehhi',
  ENG: 'Inglismaa',
  ESP: 'Hispaania',
  FRA: 'Prantsusmaa',
  GER: 'Saksamaa',
  NED: 'Holland',
  NOR: 'Norra',
  POR: 'Portugal',
  SCO: 'Šotimaa',
  SUI: 'Šveits',
  SWE: 'Rootsi',
  TUR: 'Türgi',
};

// --- Snapshot decoding -----------------------------------------------------

interface FeedTeam {
  tla: string | null;
}
interface FeedScore {
  duration?: string | null;
  fullTime?: { home?: number | null; away?: number | null } | null;
}
interface FeedMatch {
  id: number | string;
  utcDate: string;
  stage: string;
  status: string;
  matchday: number | null;
  group: string | null;
  homeTeam: FeedTeam | null;
  awayTeam: FeedTeam | null;
  score: FeedScore | null;
}
interface FeedPayload {
  matches: FeedMatch[];
}

const feed = rawFeed as unknown as FeedPayload;
const matches = feed.matches ?? [];

function groupLetterFrom(raw: string | null): string | null {
  // football-data.org emits 'GROUP_A' .. 'GROUP_L' for group-stage matches.
  if (!raw) return null;
  const m = /^GROUP_([A-L])$/.exec(raw);
  return m ? m[1] : null;
}

// --- Teams -----------------------------------------------------------------

export const wc2026Teams: TeamSeed[] = (() => {
  const byCode = new Map<string, TeamSeed>();
  for (const m of matches) {
    const letter = groupLetterFrom(m.group);
    if (!letter) continue; // skip knockout rows; teams are determined by group stage
    for (const t of [m.homeTeam, m.awayTeam]) {
      const code = t?.tla;
      if (!code) continue;
      if (byCode.has(code)) continue;
      const nameEt = teamNameEt[code];
      if (!nameEt) throw new Error(`Missing Estonian name for team code ${code}`);
      byCode.set(code, { code, nameEt, groupLetter: letter });
    }
  }
  // Sort by group letter, then alphabetically by code, for stable output.
  return [...byCode.values()].sort((a, b) => {
    if (a.groupLetter !== b.groupLetter) return a.groupLetter.localeCompare(b.groupLetter);
    return a.code.localeCompare(b.code);
  });
})();

// --- Games -----------------------------------------------------------------

function buildGroupGames(): GameSeed[] {
  const groupMatches = matches.filter((m) => m.stage === 'GROUP_STAGE');
  // Sort by group letter, then matchday, then kickoff_at so pair numbering is stable.
  groupMatches.sort((a, b) => {
    const la = groupLetterFrom(a.group) ?? '';
    const lb = groupLetterFrom(b.group) ?? '';
    if (la !== lb) return la.localeCompare(lb);
    const ma = a.matchday ?? 0;
    const mb = b.matchday ?? 0;
    if (ma !== mb) return ma - mb;
    return a.utcDate.localeCompare(b.utcDate);
  });

  const pairCounter = new Map<string, number>();
  return groupMatches.map((m) => {
    const letter = groupLetterFrom(m.group);
    if (!letter || !m.matchday) {
      throw new Error(`Group-stage match ${m.id} is missing group/matchday`);
    }
    const key = `${letter}${m.matchday}`;
    const next = (pairCounter.get(key) ?? 0) + 1;
    pairCounter.set(key, next);
    return {
      stageCode: 'group_matches',
      roundLabel: `${letter}${m.matchday}-${next}`,
      kickoffAt: m.utcDate,
      homeCode: m.homeTeam?.tla ?? null,
      awayCode: m.awayTeam?.tla ?? null,
      doublePoints: false,
    };
  });
}

function buildKnockoutGames(): GameSeed[] {
  const out: GameSeed[] = [];

  function pushOrdered(stageFeed: string, stageCode: GameSeed['stageCode'], prefix: string, pad: number) {
    const rows = matches.filter((m) => m.stage === stageFeed);
    rows.sort((a, b) => a.utcDate.localeCompare(b.utcDate));
    rows.forEach((m, i) => {
      out.push({
        stageCode,
        roundLabel: `${prefix}-${String(i + 1).padStart(pad, '0')}`,
        kickoffAt: m.utcDate,
        homeCode: m.homeTeam?.tla ?? null,
        awayCode: m.awayTeam?.tla ?? null,
        doublePoints: false,
      });
    });
  }

  pushOrdered('LAST_32', 'r32', 'R32', 2);
  pushOrdered('LAST_16', 'r16', 'R16', 2);
  pushOrdered('QUARTER_FINALS', 'qf', 'QF', 2);
  pushOrdered('SEMI_FINALS', 'sf', 'SF', 2);

  const thirdPlace = matches.find((m) => m.stage === 'THIRD_PLACE');
  if (!thirdPlace) throw new Error('Snapshot missing THIRD_PLACE match');
  out.push({
    stageCode: 'final',
    roundLabel: '3RD',
    kickoffAt: thirdPlace.utcDate,
    homeCode: thirdPlace.homeTeam?.tla ?? null,
    awayCode: thirdPlace.awayTeam?.tla ?? null,
    doublePoints: false,
  });

  const finalMatch = matches.find((m) => m.stage === 'FINAL');
  if (!finalMatch) throw new Error('Snapshot missing FINAL match');
  out.push({
    stageCode: 'final',
    roundLabel: 'FINAL',
    kickoffAt: finalMatch.utcDate,
    homeCode: finalMatch.homeTeam?.tla ?? null,
    awayCode: finalMatch.awayTeam?.tla ?? null,
    doublePoints: false,
  });

  return out;
}

export const wc2026Games: GameSeed[] = [...buildGroupGames(), ...buildKnockoutGames()];

// Match-id discovery: map from feed match.id to round_label. Consumed by the
// reseed-from-feed script so games rows are populated with `match_id` already
// linked (sidesteps the S18 first-poll discovery branch).
export const wc2026MatchIdByRoundLabel: Record<string, string> = (() => {
  const labelByKey = new Map<string, string>();
  for (const g of wc2026Games) {
    labelByKey.set(`${g.stageCode}|${g.kickoffAt}|${g.homeCode ?? ''}|${g.awayCode ?? ''}`, g.roundLabel);
  }
  const out: Record<string, string> = {};
  for (const m of matches) {
    let stageCode: GameSeed['stageCode'] | null = null;
    switch (m.stage) {
      case 'GROUP_STAGE':
        stageCode = 'group_matches';
        break;
      case 'LAST_32':
        stageCode = 'r32';
        break;
      case 'LAST_16':
        stageCode = 'r16';
        break;
      case 'QUARTER_FINALS':
        stageCode = 'qf';
        break;
      case 'SEMI_FINALS':
        stageCode = 'sf';
        break;
      case 'THIRD_PLACE':
      case 'FINAL':
        stageCode = 'final';
        break;
    }
    if (!stageCode) continue;
    const key = `${stageCode}|${m.utcDate}|${m.homeTeam?.tla ?? ''}|${m.awayTeam?.tla ?? ''}`;
    const label = labelByKey.get(key);
    if (label) out[label] = String(m.id);
  }
  return out;
})();

// --- Trivia questions (unchanged from pre-draw seed) ----------------------

export const wc2026Questions: QuestionSeed[] = [
  {
    position: 1,
    promptEt: 'Millise riigi väravatevahe on turniiri lõppedes kõige parem?',
    answerShape: 'team',
    conditionalOnPosition: null,
  },
  {
    position: 2,
    promptEt: 'Milline riik saab kõige vähem kollaseid kaarte ühe mängu kohta?',
    answerShape: 'team',
    conditionalOnPosition: null,
  },
  {
    position: 3,
    promptEt: 'Mitu punast kaarti näidatakse turniiril kokku?',
    answerShape: 'integer',
    conditionalOnPosition: null,
  },
  {
    position: 4,
    promptEt: 'Kes lööb turniiril kõige rohkem väravaid ja võidab Kuldse Saapa auhinna?',
    answerShape: 'text',
    conditionalOnPosition: null,
  },
  {
    position: 5,
    promptEt: 'Kui palju väravaid lööb turniiri parim väravakütt?',
    answerShape: 'integer',
    conditionalOnPosition: 4,
  },
];
