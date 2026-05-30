import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { games } from './games';
import { users } from './users';

export const user_games = pgTable(
  'user_games',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    game_id: uuid('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    prediction: text('prediction').notNull(),
    points: integer('points'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    user_game_unique: unique('user_games_user_game_unique').on(table.user_id, table.game_id),
  }),
);

export type UserGame = typeof user_games.$inferSelect;
export type NewUserGame = typeof user_games.$inferInsert;
