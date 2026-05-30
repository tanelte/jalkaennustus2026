import { sql } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tournaments } from './tournaments';

/**
 * Stage windows replace the legacy `Param` flag mechanism. Every prediction-write
 * Server Action consults this table server-side before persisting (Constitution
 * Critical Rule 5). The `tegelikud tulemused` singleton is exempt.
 */
export const stages = pgTable(
  'stages',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tournament_id: uuid('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    position: integer('position').notNull(),
    opens_at: timestamp('opens_at', { withTimezone: true }).notNull(),
    closes_at: timestamp('closes_at', { withTimezone: true }).notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tournament_code_unique: unique('stages_tournament_code_unique').on(
      table.tournament_id,
      table.code,
    ),
  }),
);

export type Stage = typeof stages.$inferSelect;
export type NewStage = typeof stages.$inferInsert;
