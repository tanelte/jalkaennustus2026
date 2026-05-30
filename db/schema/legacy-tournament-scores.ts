import { sql } from 'drizzle-orm';
import { integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { groups } from './groups';
import { tournaments } from './tournaments';
import { users } from './users';

/**
 * Per-tournament total scores imported from the Rails 7 predecessor.
 * Populated in S13 by the one-shot migration script; S04 only creates the
 * table. Frozen-as-scored — no recalculation.
 */
export const legacy_tournament_scores = pgTable(
  'legacy_tournament_scores',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    group_id: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    total_points: integer('total_points').notNull(),
    finishing_position: integer('finishing_position').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    group_tournament_user_unique: unique('legacy_tournament_scores_unique').on(
      table.group_id,
      table.tournament_id,
      table.user_id,
    ),
  }),
);

export type LegacyTournamentScore = typeof legacy_tournament_scores.$inferSelect;
export type NewLegacyTournamentScore = typeof legacy_tournament_scores.$inferInsert;
