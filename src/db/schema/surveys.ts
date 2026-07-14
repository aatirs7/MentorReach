import { relations, sql } from 'drizzle-orm'
import { check, jsonb, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { educationLevel } from './enums'
import { users } from './users'

/**
 * Spec §7 — the mandatory student survey. Hard rule §2.3: students are gated behind
 * this; no browsing or booking until it's complete.
 */
export const studentSurveys = pgTable(
  'student_surveys',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Q1. */
    educationLevel: educationLevel('education_level').notNull(),

    /**
     * Q2. Options depend on Q1 (HS: 9-12; college: freshman…grad), which one pg enum
     * can't express cleanly. Validated app-side by a discriminated Zod union keyed on
     * `educationLevel`.
     */
    gradeYear: text('grade_year').notNull(),

    /** Q3. */
    school: text('school').notNull(),

    /** Q4 — college only, skippable for HS. */
    major: text('major'),

    /** Q5. */
    careerInterest: text('career_interest').notNull(),

    /** Q6 — optional. */
    target: text('target'),

    /**
     * Q7. Spec says "choice: locked in ↔ exploring" but gives no type. Stored as a
     * 1-5 scale (1 = exploring, 5 = locked in) because a scale is filterable and
     * rankable where adjective enums are neither.
     *
     * OPEN QUESTION (Isaiah): confirm the labels for each point.
     */
    pathCertainty: smallint('path_certainty').notNull(),

    /** Q8 — optional. */
    priorExperience: text('prior_experience'),

    /** Q9 — multi-select checkboxes. */
    helpWith: jsonb('help_with').$type<string[]>().notNull().default([]),

    /**
     * Q9's "Other (+text)" branch. SPEC GAP: §7 offers it but §4 has no column for it.
     */
    helpWithOther: text('help_with_other'),

    /** Q10 — optional. */
    heardFrom: text('heard_from'),

    /**
     * Deliberately nullable. The §3 gate is `completed_at IS NOT NULL`, NOT row
     * existence — that lets Phase 1 save partial progress through a 10-question survey
     * without a second table. Cheap now, expensive to retrofit.
     */
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [check('student_surveys_path_certainty_range', sql`${t.pathCertainty} BETWEEN 1 AND 5`)],
)

export const studentSurveysRelations = relations(studentSurveys, ({ one }) => ({
  user: one(users, { fields: [studentSurveys.userId], references: [users.id] }),
}))
