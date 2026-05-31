import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { result_codes } from './result-codes';
import { teams } from './teams';
import { tournaments } from './tournaments';

export const games = pgTable(
  'games',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    stage_code: text('stage_code').notNull(),
    round_label: text('round_label').notNull(),
    kickoff_at: timestamp('kickoff_at', { withTimezone: true }).notNull(),
    team_home_id: uuid('team_home_id').references(() => teams.id, { onDelete: 'set null' }),
    team_away_id: uuid('team_away_id').references(() => teams.id, { onDelete: 'set null' }),
    score_home: integer('score_home'),
    score_away: integer('score_away'),
    final_status: text('final_status'),
    finish_type: text('finish_type'),
    result_code: text('result_code').references(() => result_codes.code),
    double_points: boolean('double_points').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tournament_round_unique: unique('games_tournament_round_unique').on(
      table.tournament_id,
      table.round_label,
    ),
    tournament_stage_kickoff_idx: index('games_tournament_stage_kickoff_idx').on(
      table.tournament_id,
      table.stage_code,
      table.kickoff_at,
    ),
  }),
);

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
