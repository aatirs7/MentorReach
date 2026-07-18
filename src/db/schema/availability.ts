import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { coachOfferings } from './coaches'
import { coachStudentLinks } from './links'
import { users } from './users'

/**
 * Native scheduler (replaces Calendly).
 *
 * A coach declares recurring weekly hours in their own timezone, plus one-off blackout
 * dates. We generate bookable slots from those rules minus their existing bookings — there
 * is no external calendar to sync, because the platform only ever books against itself.
 * Slot math lives in src/lib/scheduler.ts (pure); these tables are its inputs.
 *
 * FK convention (as everywhere): coach_id references users.id, never coach_profiles.id.
 */

/** A recurring weekly availability window, in the coach's timezone (coach_profiles.timezone). */
export const coachAvailabilityRules = pgTable(
  'coach_availability_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** 0 = Sunday … 6 = Saturday (JS getDay convention). */
    weekday: smallint('weekday').notNull(),

    /** Minutes from local midnight. start < end, both within [0, 1440]. */
    startMinute: integer('start_minute').notNull(),
    endMinute: integer('end_minute').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    check('availability_weekday_range', sql`${t.weekday} >= 0 AND ${t.weekday} <= 6`),
    check('availability_minute_range', sql`${t.startMinute} >= 0 AND ${t.endMinute} <= 1440 AND ${t.startMinute} < ${t.endMinute}`),
    index('coach_availability_rules_coach_idx').on(t.coachId),
  ],
)

/** A full-day exception — the coach is unavailable this whole date (their local date). */
export const coachAvailabilityBlackouts = pgTable(
  'coach_availability_blackouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Calendar date in the coach's timezone (no time component). */
    day: date('day', { mode: 'string' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [unique('coach_availability_blackouts_coach_day_unq').on(t.coachId, t.day)],
)

/**
 * A slot reserved while a student is in Stripe checkout ("pick time → pay").
 *
 * The hold is what reserves the slot for the duration of checkout; conflict checks in the
 * scheduler count non-expired holds as taken. On payment the session is created and the
 * hold deleted; if checkout is abandoned the hold expires and cron sweeps it.
 *
 * UNIQUE(coach_id, slot_start) makes two concurrent holds on the same start collide, so
 * only one student can be mid-checkout for a given slot.
 */
export const sessionHolds = pgTable(
  'session_holds',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    coachId: uuid('coach_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    offeringId: uuid('offering_id')
      .notNull()
      .references(() => coachOfferings.id, { onDelete: 'cascade' }),

    linkId: uuid('link_id')
      .notNull()
      .references(() => coachStudentLinks.id, { onDelete: 'cascade' }),

    slotStart: timestamp('slot_start', { withTimezone: true, mode: 'date' }).notNull(),
    slotEnd: timestamp('slot_end', { withTimezone: true, mode: 'date' }).notNull(),

    /** §11 acknowledgment, captured before checkout; carried onto the session on success. */
    policyAckAt: timestamp('policy_ack_at', { withTimezone: true, mode: 'date' }).notNull(),

    stripeCheckoutSessionId: text('stripe_checkout_session_id'),

    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    unique('session_holds_coach_slot_unq').on(t.coachId, t.slotStart),
    index('session_holds_expires_idx').on(t.expiresAt),
  ],
)
