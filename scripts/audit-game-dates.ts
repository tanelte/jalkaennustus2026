import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) throw new Error('DATABASE_URL_ADMIN missing');
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    // Group A explicit per-fixture (for the user's example)
    const groupAQ = await client.query<{
      round_label: string;
      kickoff_at: string;
      home_code: string | null;
      away_code: string | null;
    }>(`
      select g.round_label,
             to_char(g.kickoff_at at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as kickoff_at,
             th.code as home_code,
             ta.code as away_code
      from games g
      left join teams th on th.id = g.team_home_id
      left join teams ta on ta.id = g.team_away_id
      where g.round_label like 'A_-_'
      order by g.kickoff_at;
    `);

    // Distribution by calendar date
    const byDayQ = await client.query<{ day: string; n: string; stages: string }>(`
      select
        to_char(kickoff_at at time zone 'UTC', 'YYYY-MM-DD') as day,
        count(*) as n,
        string_agg(distinct stage_code, ',') as stages
      from games
      group by 1
      order by 1;
    `);

    // Per-group MD1/2/3 date spans
    const groupQ = await client.query<{
      group_letter: string;
      md: string;
      kickoffs: string[];
    }>(`
      select
        substr(g.round_label, 1, 1) as group_letter,
        substr(g.round_label, 2, 1) as md,
        array_agg(to_char(g.kickoff_at at time zone 'UTC', 'YYYY-MM-DD') order by g.kickoff_at)::text[] as kickoffs
      from games g
      where g.stage_code = 'group_matches'
      group by substr(g.round_label, 1, 1), substr(g.round_label, 2, 1)
      order by 1, 2;
    `);

    // Knockout stage day-spans
    const knockoutQ = await client.query<{ stage_code: string; days: string }>(`
      select stage_code,
             string_agg(distinct to_char(kickoff_at at time zone 'UTC', 'YYYY-MM-DD'), ', ' order by to_char(kickoff_at at time zone 'UTC', 'YYYY-MM-DD')) as days
      from games
      where stage_code in ('r32','r16','qf','sf','final')
      group by stage_code
      order by stage_code;
    `);

    console.log('=== Group A fixtures (DB) ===');
    for (const r of groupAQ.rows) {
      console.log(
        `${r.round_label.padEnd(6)} ${r.kickoff_at}  ${r.home_code ?? '?'} vs ${r.away_code ?? '?'}`,
      );
    }

    console.log('\n=== Games per calendar day ===');
    for (const r of byDayQ.rows) {
      console.log(`${r.day}  n=${String(r.n).padStart(2)}  stages=${r.stages}`);
    }

    console.log('\n=== Per-group matchday date spans ===');
    for (const r of groupQ.rows) {
      console.log(
        `Group ${r.group_letter}  MD${r.md}  ${r.kickoffs.length} games on ${[...new Set(r.kickoffs)].join(', ')}`,
      );
    }

    console.log('\n=== Knockout stage day ranges (DB) ===');
    for (const r of knockoutQ.rows) {
      console.log(`${r.stage_code.padEnd(5)} ${r.days}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
