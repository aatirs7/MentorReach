import { relations, sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { mentorOfferings } from './mentors'
import { sessionStatus } from './enums'
import { mentorStudentLinks } from './links'
import { users } from './users'

/**
 * Spec §8/§10/§11 — a paid mentoring session.
 *
 * Native scheduler flow: the student picks a time, then pays, so a completed checkout is
 * created directly as `booked` with a time and a Zoom meeting. `paid_unscheduled` remains
 * only as a safety net for the rare case a slot is taken during checkout.
 * Cancel branches: canceled_free (≥24h) → refunded, or canceled_late (<24h, no refund).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    offeringId: uuid('offering_id')
      .notNull()
      .references(() => mentorOfferings.id, { onDelete: 'restrict' }),

    /**
     * Not in spec §4. Makes commission provenance auditable per session: proving why a
     * given session charged 20% is a join, not an archaeology exercise reconstructing
     * the pair's link row and hoping nothing drifted. Directly supports the §2.2
     * "frozen and dumb by design" audit story.
     */
    linkId: uuid('link_id')
      .notNull()
      .references(() => mentorStudentLinks.id, { onDelete: 'restrict' }),

    amountCents: integer('amount_cents').notNull(),
    commissionCents: integer('commission_cents').notNull(),
    mentorPayoutCents: integer('mentor_payout_cents').notNull(),

    status: sessionStatus('status').notNull().default('paid_unscheduled'),

    /**
     * Nullable so admin/test/comped sessions can exist without a Stripe object;
     * presence is enforced in the app layer for real bookings.
     * UNIQUE because this is a webhook idempotency key — Stripe retries.
     */
    stripePaymentIntentId: text('stripe_payment_intent_id').unique(),

    /**
     * Zoom meeting for this session, created when the booking is confirmed. Host link goes
     * to the mentor (zoomStartUrl), join link to both parties (zoomJoinUrl). Nullable: a
     * session can be booked before the meeting is created (best-effort), and admin/comped
     * sessions may have none.
     */
    zoomMeetingId: text('zoom_meeting_id'),
    zoomJoinUrl: text('zoom_join_url'),
    zoomStartUrl: text('zoom_start_url'),

    scheduledStart: timestamp('scheduled_start', { withTimezone: true, mode: 'date' }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true, mode: 'date' }),

    /** §11: set by the completion cron once scheduled_end passes. */
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    canceledAt: timestamp('canceled_at', { withTimezone: true, mode: 'date' }),

    /**
     * §12 reminders. Not in spec §4, but without it an hourly reminder job re-sends to
     * everyone whose session is still inside the window on the next tick. This column IS
     * the idempotency key for the reminder — a time window alone isn't one.
     */
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true, mode: 'date' }),

    /**
     * When the student ticked "I understand the cancellation policy", captured at the
     * moment they started checkout and carried through Stripe metadata onto this row.
     *
     * This is chargeback-defense evidence: it is the record that the §11 non-refundable
     * terms were shown and acknowledged BEFORE any money moved, which is what makes an
     * "I didn't know" dispute fail. Nullable only because admin/comped sessions may not
     * go through checkout.
     */
    policyAckAt: timestamp('policy_ack_at', { withTimezone: true, mode: 'date' }),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    /**
     * The money invariant, enforced by Postgres. `splitAmount()` in lib/commission.ts
     * derives payout as (amount − commission) rather than rounding both independently,
     * which is what keeps this from ever firing on a rounding cent.
     */
    check(
      'sessions_amount_split_balances',
      sql`${t.amountCents} = ${t.commissionCents} + ${t.mentorPayoutCents}`,
    ),
    check('sessions_amount_positive', sql`${t.amountCents} > 0`),
    check('sessions_commission_non_negative', sql`${t.commissionCents} >= 0`),
    check('sessions_payout_non_negative', sql`${t.mentorPayoutCents} >= 0`),

    /** §12 dashboards, both roles. */
    index('sessions_mentor_start_idx').on(t.mentorId, t.scheduledStart),
    index('sessions_student_start_idx').on(t.studentId, t.scheduledStart),
    /** §11 completion cron. */
    index('sessions_status_end_idx').on(t.status, t.scheduledEnd),
    index('sessions_link_idx').on(t.linkId),
  ],
)

/** Spec §12 — brief post-session notes from the mentor, visible to that student. */
export const sessionNotes = pgTable(
  'session_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),

    mentorId: uuid('mentor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    body: text('body').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('session_notes_session_idx').on(t.sessionId)],
)

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  mentor: one(users, { fields: [sessions.mentorId], references: [users.id], relationName: 'session_mentor' }),
  student: one(users, { fields: [sessions.studentId], references: [users.id], relationName: 'session_student' }),
  offering: one(mentorOfferings, { fields: [sessions.offeringId], references: [mentorOfferings.id] }),
  link: one(mentorStudentLinks, { fields: [sessions.linkId], references: [mentorStudentLinks.id] }),
  notes: many(sessionNotes),
}))

export const sessionNotesRelations = relations(sessionNotes, ({ one }) => ({
  session: one(sessions, { fields: [sessionNotes.sessionId], references: [sessions.id] }),
  mentor: one(users, { fields: [sessionNotes.mentorId], references: [users.id] }),
}))
