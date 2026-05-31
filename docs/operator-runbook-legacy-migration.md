# Operator runbook — legacy tournament-score migration

This is the cutover playbook for moving the Rails 7 portal's per-tournament total scores into the new platform. The migration is built into the seed pipeline: any fresh database — local dev, preview, staging, production — gets the full historical dataset via `pnpm db:seed`. The legacy SQL dump is a **build-time** input, not a runtime artefact.

## Scope

Migrated:
- Per-tournament total-score rows for every (group, tournament, user) tuple in the legacy `user_results` table.
- The seven historical tournaments (EM2012, WC2014, EM2016, WC2018, EM2020, WC2022, EM2024).
- Every legacy group with its Devise bcrypt password hash carried verbatim.
- Every legacy user as a distinct identity (same name in different groups stays distinct).
- Every `tegelikud tulemused` per-tournament row collapses to the single system singleton (`is_system_user = true`).

Not migrated (PRD non-goal):
- Per-prediction detail (`user_games`, `user_teams`, `user_questions`).
- Re-scoring under the WC2026 weight table — scores are frozen as-they-were.

## Pre-cutover: 24-hour write freeze

Per ADR-03, declare a write freeze on the legacy portal **≥ 24 hours before WC2026 kickoff** (kickoff 2026-06-11 12:00 UTC → freeze in place by 2026-06-10 12:00 UTC).

1. Announce the freeze in every league's WhatsApp / Telegram channel ≥ 48h before.
2. At freeze time, mark the legacy app read-only (or stop the Rails dyno; either approach works because the dump is the only source we read).
3. Take a final `pg_dump --format=plain` of the legacy Heroku database and place it at `client-projects/jalkaennustus/dump-plain-<timestamp>.sql`.

Anything written to the legacy portal after the dump is taken is lost. The 24h window is a buffer.

## Build the legacy seed data

Once the new dump is in place:

```bash
cd client-projects/jalkaennustus2026
pnpm build-legacy-seed [path/to/dump.sql]
```

Default dump path: `../jalkaennustus/dump-plain-d11hgd41ejed91-202408181231.sql` (relative to the project root).

Expected output:

- stdout ends with `RECONCILIATION: OK` and exits 0.
- Files in `db/seed-data/legacy/` (committed): `tournaments.ts`, `groups.ts`, `users.ts`, `scores.ts`, `index.ts`.
- Report file `docs/migration-reconciliation-<YYYY-MM-DD>.md` (committed) with per-(group, tournament) breakdown.

If the script prints `RECONCILIATION: FAIL <n>`, do **not** commit the generated files. Open the report and investigate the unbalanced cells — `legacyRows ≠ produced + excludedNullPoints + collapsedSingletonDuplicates + orphanRefs + unknownTournament` means a row went un-accounted-for. Most common causes:

- A new tournament id appeared in the dump that's not in `HISTORICAL_TOURNAMENTS` (`scripts/legacy/transforms.ts`).
- The dump format changed (a new column appeared on one of the five COPY blocks).
- A `user_groups` row in the dump has a NULL `user_id` or `group_id` we now need to account for.

Commit the freshly built `db/seed-data/legacy/**` + the report alongside any code change required to make reconciliation pass.

## Cutover

Against a fresh Supabase database:

```bash
pnpm db:migrate   # runs through 0008
pnpm db:seed      # WC2026 schedule + legacy backfill
```

Re-running `pnpm db:seed` on a populated DB is safe — every step is `ON CONFLICT DO NOTHING`, and legacy users are deduplicated via the `legacy_user_seed_map` table. Row counts won't change on a second run.

Spot-check the migration:

```sql
-- Exactly one singleton.
select count(*) from users where is_system_user = true;

-- Seven historical tournaments + WC2026.
select code from tournaments order by starts_at;

-- Per-tournament score counts.
select t.code, count(*)
from legacy_tournament_scores l
join tournaments t on t.id = l.tournament_id
group by t.code
order by t.code;

-- Same name in different groups is allowed now.
select username, count(*) from users group by username having count(*) > 1;
```

## Reconciliation policy

Acceptance for the migration: **every (legacy_group, legacy_tournament) bucket balances** — `legacyRows == produced + excludedNullPoints + collapsedSingletonDuplicates + orphanRefs + unknownTournament`. The report makes that visible per row; if it says OK, the migration is complete.
