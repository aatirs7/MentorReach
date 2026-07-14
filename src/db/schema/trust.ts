import { relations, sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { reportStatus } from './enums'
import { sessions } from './sessions'
import { users } from './users'

/** Spec §12 — either party can report; lands in the admin review queue. */
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    reportedUserId: uuid('reported_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),

    /**
     * Deliberately `text`, not an enum: the category set is open and will churn, and
     * you do not want a database migration to add a report category.
     */
    category: text('category').notNull(),

    description: text('description').notNull(),

    status: reportStatus('status').notNull().default('open'),

    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    /** The §12 admin queue: open reports, oldest first. */
    index('reports_status_created_idx').on(t.status, t.createdAt),
    index('reports_reported_user_idx').on(t.reportedUserId),
  ],
)

/**
 * Spec §12 — in-app notification list. Paired with a Resend email at send time.
 * Real-time is explicitly not required for v1.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Open set — `text`, not an enum. New notification types must not need a migration. */
    type: text('type').notNull(),

    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),

    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
    /** Partial index for the unread badge — the only hot query on this table. */
    index('notifications_unread_idx')
      .on(t.userId)
      .where(sql`${t.readAt} IS NULL`),
  ],
)

export const reportsRelations = relations(reports, ({ one }) => ({
  reporter: one(users, { fields: [reports.reporterId], references: [users.id], relationName: 'report_reporter' }),
  reportedUser: one(users, { fields: [reports.reportedUserId], references: [users.id], relationName: 'report_reported' }),
  session: one(sessions, { fields: [reports.sessionId], references: [sessions.id] }),
  reviewer: one(users, { fields: [reports.reviewedBy], references: [users.id], relationName: 'report_reviewer' }),
}))

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}))
