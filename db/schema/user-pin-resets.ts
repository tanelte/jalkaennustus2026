import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * E03 — PIN reset tokens. A row carries the sha256 hash of the raw token sent
 * by email (architecture D3); the raw token never lives in the DB. Issued by
 * `lib/pin/recovery.ts` (S05), consumed by the public `/pin/reset/[token]`
 * surface. The table exists from S01 so S05 lands under additive-only
 * discipline per Constitution Rule 9.
 */
export const user_pin_resets = pgTable(
  'user_pin_resets',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull().unique(),
    expires_at: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumed_at: timestamp('consumed_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    user_active_idx: index('user_pin_resets_user_active_idx').on(
      table.user_id,
      table.consumed_at,
      table.expires_at,
    ),
  }),
);

export type UserPinReset = typeof user_pin_resets.$inferSelect;
export type NewUserPinReset = typeof user_pin_resets.$inferInsert;
