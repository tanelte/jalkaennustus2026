import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { teams } from './teams';
import { tournaments } from './tournaments';
import { users } from './users';

/**
 * Knockout team-advancement picks (R32 / R16 / QF / SF) and final-stage F1/F2/F3/F4 picks.
 * `round` is one of: r32 | r16 | qf | sf | final.
 * `slot` is the bracket position (e.g. 'R32-01') or final medal slot ('F1', 'F2', 'F3', 'F4').
 */
export const user_teams = pgTable(
  'user_teams',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    round: text('round').notNull(),
    slot: text('slot').notNull(),
    team_id: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    points: integer('points'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    user_round_slot_unique: unique('user_teams_user_round_slot_unique').on(
      table.user_id,
      table.tournament_id,
      table.round,
      table.slot,
    ),
  }),
);

export type UserTeam = typeof user_teams.$inferSelect;
export type NewUserTeam = typeof user_teams.$inferInsert;
