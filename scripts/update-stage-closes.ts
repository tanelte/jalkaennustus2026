/**
 * Apply current deriveStages() output to the trivia + best_thirds rows in DB.
 * Idempotent; only updates rows whose closes_at differs from the derived value.
 * Used when the stage-closing rule changes (see derive-stages.ts docstring)
 * without doing a full reseed.
 */
import { Client } from 'pg';
import { config } from 'dotenv';
import { wc2026Tournament, wc2026Games } from '../db/seed-data/wc2026';
import { deriveStages } from '../db/seed-data/derive-stages';

config({ path: '.env.local' });

const STAGES_TO_UPDATE = ['trivia', 'best_thirds'] as const;

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL_ADMIN;
  if (!url) {
    console.error('DATABASE_URL_ADMIN missing');
    return 1;
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const t = await client.query<{ id: string }>(
      'select id from tournaments where code = $1',
      [wc2026Tournament.code],
    );
    const tournamentId = t.rows[0]?.id;
    if (!tournamentId) throw new Error('WC2026 tournament not found');

    const derived = deriveStages(wc2026Tournament, wc2026Games);
    const byCode = new Map(derived.map((s) => [s.code, s]));

    await client.query('begin');
    for (const code of STAGES_TO_UPDATE) {
      const stage = byCode.get(code);
      if (!stage) throw new Error(`Derived stage missing: ${code}`);
      const before = await client.query<{ closes_at: string }>(
        `select closes_at::text from stages where tournament_id = $1 and code = $2`,
        [tournamentId, code],
      );
      const r = await client.query(
        `update stages
           set closes_at = $3,
               opens_at  = $4
         where tournament_id = $1 and code = $2`,
        [tournamentId, code, stage.closesAt, stage.opensAt],
      );
      console.log(
        JSON.stringify({
          operation: 'update_stage_closes',
          step: 'updated',
          stage: code,
          prior_closes_at: before.rows[0]?.closes_at ?? null,
          new_closes_at: stage.closesAt,
          rows_affected: r.rowCount,
        }),
      );
    }
    await client.query('commit');
    console.log(JSON.stringify({ operation: 'update_stage_closes', outcome: 'ok' }));
    return 0;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    console.error(JSON.stringify({
      operation: 'update_stage_closes',
      outcome: 'error',
      message: err instanceof Error ? err.message : String(err),
    }));
    return 1;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
