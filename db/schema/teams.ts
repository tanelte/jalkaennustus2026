import { sql } from 'drizzle-orm';
import { char, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name_et: text('name_et').notNull(),
    group_letter: char('group_letter', { length: 1 }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tournament_code_unique: unique('teams_tournament_code_unique').on(
      table.tournament_id,
      table.code,
    ),
    tournament_group_idx: index('teams_tournament_group_idx').on(
      table.tournament_id,
      table.group_letter,
    ),
  }),
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
