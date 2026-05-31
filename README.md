# Jalkaennustus 2026

[![CI](https://github.com/tanelte/jalkaennustus2026/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tanelte/jalkaennustus2026/actions/workflows/ci.yml)

Next.js 15 App Router + Supabase Postgres prediction platform for FIFA World Cup 2026.

Project context lives in the parent repo:

- `../../.ai_project_memory/general-overview.md` — project identity
- `../../.ai_project_memory/architecture.md` — platform architecture
- `../../.ai_project_memory/constitution.md` — universal rules
- `../../specs/E01-wc2026-rewrite/` — inaugural epic (PRD, architecture, ADRs, stories)

## Run locally

**Prerequisites**

- Node.js 22 (see `.nvmrc`) — `nvm use` if you have nvm.
- pnpm 9+
- Docker Desktop (for Supabase CLI / local Postgres).
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `brew install supabase/tap/supabase`.

**First-time setup**

```bash
cd client-projects/jalkaennustus2026
pnpm install
supabase start                       # boots local Postgres on :54322
cp .env.local.example .env.local     # then paste the URLs printed by `supabase start`
pnpm db:migrate                      # applies db/migrations/*.sql, seeds the singleton
pnpm create-group --username demo --password "correct horse battery staple"
pnpm dev                             # http://localhost:3000
```

Open <http://localhost:3000> — you will be redirected to `/login`. Use the group credentials you seeded with `pnpm create-group`. Once authenticated, the home page reports **DB connected** and shows the logged-in group name.

**`.env.local`**

`supabase start` prints two connection strings. Map them per Constitution Critical Rule 4:

- `DATABASE_URL` ← the **transaction-pooled** URL (PgBouncer; app code).
- `DATABASE_URL_ADMIN` ← the **session-pooled** / direct URL (migrations, scripts).

Mixing them breaks prepared statements.

**Common commands**

| Command | What it does |
|---|---|
| `pnpm dev` | Next.js dev server on `:3000` |
| `pnpm typecheck` | TypeScript strict-mode check |
| `pnpm lint` | ESLint + `eslint-plugin-jsx-a11y` |
| `pnpm test` | Vitest run |
| `pnpm test:coverage` | Vitest with the `lib/scoring/**` 100% gate |
| `pnpm db:generate` | Drizzle: generate migration from schema diff |
| `pnpm db:migrate` | Apply pending `db/migrations/*.sql` files (forward-only) |
| `pnpm db:studio` | Drizzle browser at <http://localhost:4983> |
| `pnpm create-group --username … --password …` | Seed a group account (admin-driven; no public signup) |

**Troubleshooting**

- *"DB error: …"* on the home page — check `.env.local` and that `supabase start` is running.
- *Prepared statement errors during migration* — `pnpm db:migrate` must use `DATABASE_URL_ADMIN`, not the transaction-pooled URL.
- *Test coverage failure with no scoring code* — `lib/scoring/` is empty by design until story S03 lands.
