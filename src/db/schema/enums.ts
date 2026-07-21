import { pgEnum } from 'drizzle-orm/pg-core'

/**
 * Native pg enums are used where the value set is closed and owned by us.
 * Open/churning sets (reports.category, grade_year, industry) stay `text` —
 * altering a pg enum is painful and not worth a migration per new value.
 */

/** Spec §3. */
export const userRole = pgEnum('user_role', ['student', 'mentor', 'admin'])

/** Spec §7 Q1. */
export const educationLevel = pgEnum('education_level', ['hs', 'college'])

/** Spec §5 / §2.4 — new mentor profiles start `pending` and are unbookable. */
export const mentorStatus = pgEnum('mentor_status', ['pending', 'approved', 'suspended'])

/** Spec §6 — how the mentor/student relationship was sourced. Frozen at first bind. */
export const sourcedVia = pgEnum('sourced_via', ['referral', 'platform'])

/**
 * Spec §11 state machine.
 *   paid_unscheduled → booked → (rescheduled) → completed
 * Cancel branches: canceled_free (≥24h) → refunded, or canceled_late (<24h, no refund).
 *
 * NOTE (open question, see plan): `canceled_free` and `refunded` are sequential,
 * not alternative — `canceled_free` is intent at cancel time, `refunded` is fact
 * once Stripe confirms. Refunds are async; we need a state for the gap.
 */
export const sessionStatus = pgEnum('session_status', [
  'paid_unscheduled',
  'booked',
  'rescheduled',
  'completed',
  'canceled_free',
  'canceled_late',
  'refunded',
])

/** Spec §12 admin review queue. */
export const reportStatus = pgEnum('report_status', ['open', 'reviewed', 'actioned'])
