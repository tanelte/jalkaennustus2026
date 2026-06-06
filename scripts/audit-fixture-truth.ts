/**
 * Diagnostic: contrast the seeded teams/games against the football-data.org
 * truth. Prints (a) teams in the seed vs teams in the feed, (b) the real
 * groups derived from MD1 fixtures, (c) total counts per stage.
 */
import { config } from 'dotenv';
import { createFootballDataOrgProvider } from '@/lib/football-data/football-data-org';
import { wc2026Teams } from '../db/seed-data/wc2026';

config({ path: '.env.local' });

async function main() {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) throw new Error('FOOTBALL_DATA_API_KEY missing');
  const provider = createFootballDataOrgProvider({
    apiKey,
    baseUrl: process.env.FOOTBALL_DATA_BASE_URL ?? 'https://api.football-data.org',
  });
  const out = await provider.fetchTournamentMatches({
    competitionCode: process.env.FOOTBALL_DATA_COMPETITION_CODE ?? 'WC',
  });

  const seedTeams = new Set(wc2026Teams.map((t) => t.code));
  const feedTeams = new Set<string>();
  for (const m of out.matches) {
    if (m.team_home_code) feedTeams.add(m.team_home_code);
    if (m.team_away_code) feedTeams.add(m.team_away_code);
  }

  const onlySeed = [...seedTeams].filter((t) => !feedTeams.has(t)).sort();
  const onlyFeed = [...feedTeams].filter((t) => !seedTeams.has(t)).sort();
  const both = [...seedTeams].filter((t) => feedTeams.has(t)).sort();

  console.log(`Seed teams: ${seedTeams.size}, Feed teams: ${feedTeams.size}, Overlap: ${both.length}`);
  console.log('\n=== In seed only (placeholder teams that did not qualify / wrong code) ===');
  console.log(onlySeed.join(', ') || '(none)');
  console.log('\n=== In feed only (real qualifiers missing from seed) ===');
  console.log(onlyFeed.join(', ') || '(none)');

  // Derive real groups: a "group" is the smallest set of 4 teams where each
  // team plays exactly the other 3 in group-stage-dated matches. We use the
  // first 72 sorted matches by kickoff (= group stage).
  const sorted = [...out.matches].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
  const groupStage = sorted.slice(0, 72);
  // Union-find on team codes via shared matches
  const parent = new Map<string, string>();
  function find(x: string): string {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  }
  function union(a: string, b: string) {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const m of groupStage) {
    if (m.team_home_code && m.team_away_code) union(m.team_home_code, m.team_away_code);
  }
  const groups = new Map<string, string[]>();
  for (const team of parent.keys()) {
    const r = find(team);
    const arr = groups.get(r) ?? [];
    arr.push(team);
    groups.set(r, arr);
  }
  const groupList = [...groups.values()].map((g) => g.sort()).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`\n=== Real groups (${groupList.length} of size ${groupList[0]?.length}) ===`);
  for (let i = 0; i < groupList.length; i++) {
    const letter = String.fromCharCode(65 + i);
    console.log(`Group ${letter}: ${groupList[i].join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
