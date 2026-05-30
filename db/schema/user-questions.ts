import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { questions } from './questions';
import { users } from './users';

export const user_questions = pgTable(
  'user_questions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    question_id: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    answer: text('answer').notNull(),
    points: integer('points'),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    user_question_unique: unique('user_questions_user_question_unique').on(
      table.user_id,
      table.question_id,
    ),
  }),
);

export type UserQuestion = typeof user_questions.$inferSelect;
export type NewUserQuestion = typeof user_questions.$inferInsert;
