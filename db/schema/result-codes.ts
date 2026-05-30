import { pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Result-code lookup table (LOCKED-7 in the brainstorming session).
 * Replaces the hardcoded Estonian strings in the legacy VUserGames/VUserTeams views.
 */
export const result_codes = pgTable('result_codes', {
  code: text('code').primaryKey(),
  label_et: text('label_et').notNull(),
  meaning_machine: text('meaning_machine').notNull(),
});

export type ResultCodeRow = typeof result_codes.$inferSelect;
export type NewResultCodeRow = typeof result_codes.$inferInsert;
