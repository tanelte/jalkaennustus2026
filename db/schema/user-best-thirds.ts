import { sql } from 'drizzle-orm';
import { char, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';
import { users } from './users';

/**
 * 8-best-thirds picks: a player ticks 8 of the 12 group letters (A–L) to mark
 * which group-third teams they think advance to the Round of 32. Composite
 * uniqueness per architecture LOCKED-1. The exactly-8-rows constraint per
 * (user, tournament) is enforced in the Server Action (S07), not the schema.
 */
export const user_best_thirds = pgTable(
  'user_best_thirds',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    group_letter: char('group_letter', { length: 1 }).notNull(),
    points: integer('points'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    user_tournament_letter_unique: unique('user_best_thirds_user_tournament_letter_unique').on(
      table.user_id,
      table.tournament_id,
      table.group_letter,
    ),
  }),
);

export type UserBestThird = typeof user_best_thirds.$inferSelect;
export type NewUserBestThird = typeof user_best_thirds.$inferInsert;
