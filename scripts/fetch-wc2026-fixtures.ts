/**
 * Diagnostic: fetch the WC2026 fixture list from football-data.org and print
 * a summary so we can confirm coverage + correctness before reseeding.
 *
 * Usage: pnpm tsx scripts/fetch-wc2026-fixtures.ts
 */
import { config } from 'dotenv';
import { createFootballDataOrgProvider } from '@/lib/football-data/football-data-org';

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
  console.log(
    JSON.stringify(
      {
        operation: 'fetch_wc2026_fixtures',
        outcome: 'ok',
        matches_total: out.matches.length,
        rate_limit_remaining_minute: out.rate_limit.remaining_minute,
      },
      null,
      2,
    ),
  );

  // First 12 matches (= first MD1 day for each group, roughly)
  console.log('\n=== First 12 matches by kickoff ===');
  const sorted = [...out.matches].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
  for (const m of sorted.slice(0, 12)) {
    console.log(
      `${m.kickoff_at}  ${(m.team_home_code ?? '?').padEnd(4)} vs ${(m.team_away_code ?? '?').padEnd(4)}  status=${m.final_status}  finish=${m.finish_type ?? '-'}`,
    );
  }

  // Distribution by date
  const byDay = new Map<string, number>();
  for (const m of out.matches) {
    const day = m.kickoff_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  console.log('\n=== Games per calendar day (feed) ===');
  for (const [day, n] of [...byDay.entries()].sort()) {
    console.log(`${day}  n=${n}`);
  }

  // Group A specifically
  console.log('\n=== Feed matches involving USA, NOR, JPN, NZL (Group A teams in our seed) ===');
  const groupA = sorted.filter(
    (m) =>
      ['USA', 'NOR', 'JPN', 'NZL'].includes(m.team_home_code ?? '') ||
      ['USA', 'NOR', 'JPN', 'NZL'].includes(m.team_away_code ?? ''),
  );
  for (const m of groupA) {
    console.log(`${m.kickoff_at}  ${m.team_home_code} vs ${m.team_away_code}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
