import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * The literal string 'tegelikud tulemused' identifies the system-singleton user
 * that owns official tournament results. Constitution Critical Rule 1.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  username: text('username').notNull(),
  is_system_user: boolean('is_system_user').notNull().default(false),
  is_operator: boolean('is_operator').notNull().default(false),
  // E03 — per-user PIN. Both columns nullable: a user only carries PIN material
  // once they opt in via /me/pin. Disabling the PIN clears both atomically.
  pin_hash: text('pin_hash'),
  recovery_email: text('recovery_email'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
