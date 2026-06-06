/**
 * Hardcoded seed data for FIFA World Cup 2026.
 *
 * Source of truth: this file. The seed script in scripts/seed.ts consumes
 * these structures and writes them to the database idempotently.
 *
 * The team-to-group assignment is a plausible placeholder until the operator
 * runs the post-draw correction. The 48-team count, 12-group structure, 104
 * games (72 group + 16 R32 + 8 R16 + 4 QF + 2 SF + 1 3rd-place + 1 Final), and
 * stage timing are correct.
 */

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

const groupRoster: Record<string, [string, string, string, string]> = {
  A: ['USA', 'NOR', 'JPN', 'NZL'],
  B: ['CAN', 'ENG', 'MAR', 'JAM'],
  C: ['MEX', 'ESP', 'KOR', 'CRC'],
  D: ['ARG', 'FRA', 'AUS', 'GHA'],
  E: ['BRA', 'GER', 'EGY', 'PAN'],
  F: ['URU', 'ITA', 'IRN', 'WAL'],
  G: ['COL', 'POR', 'KSA', 'COD'],
  H: ['ECU', 'NED', 'QAT', 'ALG'],
  I: ['PAR', 'BEL', 'IRQ', 'CMR'],
  J: ['CRO', 'DEN', 'UZB', 'TUN'],
  K: ['SUI', 'POL', 'SRB', 'CIV'],
  L: ['AUT', 'TUR', 'SEN', 'NGA'],
};

const teamNameEt: Record<string, string> = {
  USA: 'Ameerika Ühendriigid',
  CAN: 'Kanada',
  MEX: 'Mehhiko',
  ARG: 'Argentina',
  BRA: 'Brasiilia',
  URU: 'Uruguay',
  COL: 'Colombia',
  ECU: 'Ecuador',
  PAR: 'Paraguay',
  CRC: 'Costa Rica',
  JAM: 'Jamaica',
  PAN: 'Panama',
  ESP: 'Hispaania',
  FRA: 'Prantsusmaa',
  GER: 'Saksamaa',
  ENG: 'Inglismaa',
  ITA: 'Itaalia',
  POR: 'Portugal',
  NED: 'Holland',
  BEL: 'Belgia',
  CRO: 'Horvaatia',
  DEN: 'Taani',
  SUI: 'Šveits',
  POL: 'Poola',
  AUT: 'Austria',
  NOR: 'Norra',
  SRB: 'Serbia',
  TUR: 'Türgi',
  JPN: 'Jaapan',
  KOR: 'Lõuna-Korea',
  IRN: 'Iraan',
  AUS: 'Austraalia',
  KSA: 'Saudi Araabia',
  QAT: 'Katar',
  IRQ: 'Iraak',
  UZB: 'Usbekistan',
  MAR: 'Maroko',
  SEN: 'Senegal',
  EGY: 'Egiptus',
  NGA: 'Nigeeria',
  ALG: 'Alžeeria',
  CMR: 'Kamerun',
  GHA: 'Ghana',
  TUN: 'Tuneesia',
  CIV: 'Elevandiluurannik',
  NZL: 'Uus-Meremaa',
  WAL: 'Wales',
  COD: 'Kongo DV',
};

export const wc2026Teams: TeamSeed[] = (() => {
  const out: TeamSeed[] = [];
  for (const [letter, codes] of Object.entries(groupRoster)) {
    for (const code of codes) {
      const nameEt = teamNameEt[code];
      if (!nameEt) throw new Error(`Missing Estonian name for team code ${code}`);
      out.push({ code, nameEt, groupLetter: letter });
    }
  }
  return out;
})();

function setUtc(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const SLOT_HOURS_GROUP = [12, 15, 18, 21];

function buildGroupMatches(): GameSeed[] {
  type Pair = { letter: string; md: number; pair: 1 | 2; home: string; away: string };
  const pairs: Pair[] = [];
  for (const [letter, t] of Object.entries(groupRoster)) {
    pairs.push({ letter, md: 1, pair: 1, home: t[0], away: t[1] });
    pairs.push({ letter, md: 1, pair: 2, home: t[2], away: t[3] });
    pairs.push({ letter, md: 2, pair: 1, home: t[0], away: t[2] });
    pairs.push({ letter, md: 2, pair: 2, home: t[1], away: t[3] });
    pairs.push({ letter, md: 3, pair: 1, home: t[0], away: t[3] });
    pairs.push({ letter, md: 3, pair: 2, home: t[1], away: t[2] });
  }

  // Curated double-points selection: one marquee fixture (R1/R2) per group
  // plus the best-matched matchday-3 fixture. Operator finalises the live
  // set before kickoff; scripts/update-double-points.ts keeps DB in sync.
  const DOUBLE_POINTS_ROUND_LABELS = new Set([
    // Marquee (R1/R2)
    'A1-1', 'B1-1', 'C1-1', 'D1-1', 'D2-2', 'E1-1', 'F1-1', 'G1-1',
    'H1-1', 'I1-1', 'I2-2', 'J1-1', 'J2-2', 'K1-1', 'L1-2',
    // Decisive R3 (best-matched final-round fixture per group)
    'A3-2', 'B3-2', 'C3-2', 'E3-2', 'F3-2', 'G3-2', 'H3-1', 'K3-2', 'L3-2',
  ]);

  const base = new Date('2026-06-11T00:00:00Z');
  return pairs.map((p, i) => {
    const day = Math.floor(i / SLOT_HOURS_GROUP.length);
    const slot = i % SLOT_HOURS_GROUP.length;
    const kickoff = setUtc(addDays(base, day), SLOT_HOURS_GROUP[slot], 0);
    const roundLabel = `${p.letter}${p.md}-${p.pair}`;
    return {
      stageCode: 'group_matches' as const,
      roundLabel,
      kickoffAt: kickoff.toISOString(),
      homeCode: p.home,
      awayCode: p.away,
      doublePoints: DOUBLE_POINTS_ROUND_LABELS.has(roundLabel),
    };
  });
}

function buildKnockoutGames(): GameSeed[] {
  const games: GameSeed[] = [];

  // R32: 16 games across June 29 - July 2 (4 days × 4 slots).
  const r32Base = new Date('2026-06-29T00:00:00Z');
  for (let i = 0; i < 16; i++) {
    const day = Math.floor(i / 4);
    const slot = i % 4;
    const kickoff = setUtc(addDays(r32Base, day), SLOT_HOURS_GROUP[slot], 0);
    games.push({
      stageCode: 'r32',
      roundLabel: `R32-${String(i + 1).padStart(2, '0')}`,
      kickoffAt: kickoff.toISOString(),
      homeCode: null,
      awayCode: null,
      doublePoints: false,
    });
  }

  // R16: 8 games across July 4 - July 7 (4 days × 2 slots at 15:00 and 21:00).
  const r16Base = new Date('2026-07-04T00:00:00Z');
  const r16Slots = [15, 21];
  for (let i = 0; i < 8; i++) {
    const day = Math.floor(i / 2);
    const slot = i % 2;
    const kickoff = setUtc(addDays(r16Base, day), r16Slots[slot], 0);
    games.push({
      stageCode: 'r16',
      roundLabel: `R16-${String(i + 1).padStart(2, '0')}`,
      kickoffAt: kickoff.toISOString(),
      homeCode: null,
      awayCode: null,
      doublePoints: false,
    });
  }

  // QF: 4 games on July 9 and July 11 (2 per day).
  const qfKickoffs = [
    '2026-07-09T18:00:00Z',
    '2026-07-09T21:00:00Z',
    '2026-07-11T18:00:00Z',
    '2026-07-11T21:00:00Z',
  ];
  qfKickoffs.forEach((k, i) => {
    games.push({
      stageCode: 'qf',
      roundLabel: `QF-0${i + 1}`,
      kickoffAt: k,
      homeCode: null,
      awayCode: null,
      doublePoints: false,
    });
  });

  // SF: 2 games on July 14 and July 15.
  const sfKickoffs = ['2026-07-14T20:00:00Z', '2026-07-15T20:00:00Z'];
  sfKickoffs.forEach((k, i) => {
    games.push({
      stageCode: 'sf',
      roundLabel: `SF-0${i + 1}`,
      kickoffAt: k,
      homeCode: null,
      awayCode: null,
      doublePoints: false,
    });
  });

  // 3rd-place playoff and Final: both tagged stage 'final'.
  games.push({
    stageCode: 'final',
    roundLabel: '3RD',
    kickoffAt: '2026-07-18T20:00:00Z',
    homeCode: null,
    awayCode: null,
    doublePoints: false,
  });
  games.push({
    stageCode: 'final',
    roundLabel: 'FINAL',
    kickoffAt: '2026-07-19T20:00:00Z',
    homeCode: null,
    awayCode: null,
    doublePoints: false,
  });

  return games;
}

export const wc2026Games: GameSeed[] = [...buildGroupMatches(), ...buildKnockoutGames()];

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
