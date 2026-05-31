import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { groups } from './groups';
import { users } from './users';

export const user_groups = pgTable(
  'user_groups',
  {
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    group_id: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.user_id, table.group_id] }),
  }),
);

export type UserGroup = typeof user_groups.$inferSelect;
export type NewUserGroup = typeof user_groups.$inferInsert;
