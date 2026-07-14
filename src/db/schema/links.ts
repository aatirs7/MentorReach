import { relations, sql } from 'drizzle-orm'
import { check, index, integer, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sourcedVia } from './enums'
import { users } from './users'

/**
 * Spec §6 — the frozen commission relationship.
 *
 * Created the FIRST time a student transacts with a given coach, and never
 * re-evaluated. Every future session between that pair reads this frozen value.
 * No re-computation, no overrides, no case-by-case (hard rule §2.2).
 *
 * The UNIQUE(coach_id, student_id) constraint below IS that hard rule, expressed in
 * the database rather than in discipline: there is physically nowhere to put a second
 * commission value for a pair.
 *
 * Attribution logic lives in `src/lib/commission.ts` — one pure function, deliberately
 * quarantined because spec §14.1 is still an open question.
 */
export const coachStudentLinks = pgTable(
  'coach_student_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    /**
     * 2000 = 20% (coach-sourced/referral), 3000 = 30% (platform-sourced).
     * integer + CHECK rather than an enum: this value gets arithmetic done to it.
     */
    commissionBps: integer('commission_bps').notNull(),

    sourcedVia: sourcedVia('sourced_via').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    /** Hard rule §2.2, enforced by Postgres. */
    unique('coach_student_links_pair_unq').on(t.coachId, t.studentId),
    check('coach_student_links_bps_allowed', sql`${t.commissionBps} IN (2000, 3000)`),
    index('coach_student_links_student_idx').on(t.studentId),
  ],
)

export const coachStudentLinksRelations = relations(coachStudentLinks, ({ one }) => ({
  coach: one(users, { fields: [coachStudentLinks.coachId], references: [users.id], relationName: 'link_coach' }),
  student: one(users, { fields: [coachStudentLinks.studentId], references: [users.id], relationName: 'link_student' }),
}))
