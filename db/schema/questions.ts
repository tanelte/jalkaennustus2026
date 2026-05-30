import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';

/**
 * Trivia questions. Position 5 sets `conditional_on_position = 4` (Q5 scores
 * zero unless Q4 is also correct; the Q5-conditional-on-Q4 trick from the
 * brainstorming session).
 */
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    prompt_et: text('prompt_et').notNull(),
    answer_shape: text('answer_shape').notNull(),
    correct_answer: text('correct_answer'),
    conditional_on_position: integer('conditional_on_position'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tournament_position_unique: unique('questions_tournament_position_unique').on(
      table.tournament_id,
      table.position,
    ),
  }),
);

export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
