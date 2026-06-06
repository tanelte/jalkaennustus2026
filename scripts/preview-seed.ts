import {
  wc2026Games,
  wc2026Teams,
  wc2026MatchIdByRoundLabel,
} from '../db/seed-data/wc2026';

console.log(
  JSON.stringify(
    {
      teams: wc2026Teams.length,
      games: wc2026Games.length,
      group_games: wc2026Games.filter((g) => g.stageCode === 'group_matches').length,
      r32: wc2026Games.filter((g) => g.stageCode === 'r32').length,
      r16: wc2026Games.filter((g) => g.stageCode === 'r16').length,
      qf: wc2026Games.filter((g) => g.stageCode === 'qf').length,
      sf: wc2026Games.filter((g) => g.stageCode === 'sf').length,
      final: wc2026Games.filter((g) => g.stageCode === 'final').length,
      match_ids_linked: Object.keys(wc2026MatchIdByRoundLabel).length,
    },
    null,
    2,
  ),
);
console.log('\nFirst 8 group A fixtures:');
const groupA = wc2026Teams.filter((t) => t.groupLetter === 'A').map((t) => t.code);
const aGames = wc2026Games.filter(
  (g) =>
    g.stageCode === 'group_matches' &&
    (groupA.includes(g.homeCode ?? '') || groupA.includes(g.awayCode ?? '')),
);
for (const g of aGames) {
  console.log(`  ${g.roundLabel}  ${g.kickoffAt}  ${g.homeCode}-${g.awayCode}`);
}
console.log('\nKnockout day spans:');
for (const stage of ['r32', 'r16', 'qf', 'sf', 'final']) {
  const days = [
    ...new Set(
      wc2026Games.filter((g) => g.stageCode === stage).map((g) => g.kickoffAt.slice(0, 10)),
    ),
  ].sort();
  console.log(`  ${stage}: ${days.join(', ')}`);
}
