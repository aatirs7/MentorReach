import 'server-only'
import { and, eq, inArray, lt } from 'drizzle-orm'
import { db } from '@/db'
import {
  coachOfferings,
  coachProfiles,
  coachStudentLinks,
  sessionHolds,
  sessions,
  users,
} from '@/db/schema'
import { resolveCommission, splitAmount } from './commission'
import { env } from './env'
import { isSlotOpen } from './scheduling'
import { stripe } from './stripe'

/** How long a picked slot is reserved while the student checks out (Stripe's minimum). */
export const HOLD_MINUTES = 30

/**
 * Native scheduler booking sequence (§8/§10) — pick a time, THEN pay.
 *
 *   1. Student picks a coach, a session length, and an open slot.
 *   2. We reserve the slot with a session_holds row (unique per coach+slot).
 *   3. Stripe Connect payment (§10 destination charge), the hold spanning checkout.
 *   4. On checkout.session.completed: the session is created directly as `booked` with the
 *      chosen time, a Zoom meeting is created, and the hold is deleted.
 *   5. Safety net: if the slot was somehow taken during checkout, the session is created as
 *      `paid_unscheduled` and the student is asked to pick another time.
 */

export class BookingError extends Error {}

/**
 * Spec §6 — get or create the frozen commission relationship for this pair.
 *
 * The freeze happens exactly once, at the first transaction. Every later session reads
 * the stored value; the rate is NEVER recomputed (hard rule §2.2). Note this function
 * reads the existing row first and returns it untouched if present — that, plus
 * UNIQUE(coach_id, student_id), is what makes the freeze real.
 */
export async function getOrCreateLink(params: {
  coachUserId: string
  studentUserId: string
  studentReferredByCoachId: string | null
}) {
  const existing = await db.query.coachStudentLinks.findFirst({
    where: and(
      eq(coachStudentLinks.coachId, params.coachUserId),
      eq(coachStudentLinks.studentId, params.studentUserId),
    ),
  })

  if (existing) return existing

  const { commissionBps, sourcedVia } = resolveCommission({
    coachId: params.coachUserId,
    studentReferredByCoachId: params.studentReferredByCoachId,
  })

  const [created] = await db
    .insert(coachStudentLinks)
    .values({
      coachId: params.coachUserId,
      studentId: params.studentUserId,
      commissionBps,
      sourcedVia,
    })
    /**
     * Two concurrent first-bookings would both miss the SELECT above and both insert.
     * UNIQUE(coach_id, student_id) turns the loser into a no-op rather than an error,
     * and `returning()` hands back the row that won. The rate is identical either way —
     * resolveCommission is pure — so this can't produce a wrong freeze, only a
     * duplicate-key crash if we didn't handle it.
     */
    .onConflictDoNothing({ target: [coachStudentLinks.coachId, coachStudentLinks.studentId] })
    .returning()

  if (created) return created

  const raced = await db.query.coachStudentLinks.findFirst({
    where: and(
      eq(coachStudentLinks.coachId, params.coachUserId),
      eq(coachStudentLinks.studentId, params.studentUserId),
    ),
  })

  if (!raced) throw new BookingError('Could not establish the coach/student relationship.')

  return raced
}

/**
 * The whole "pick → hold → checkout" step. Validates the slot is still open, reserves it
 * with a hold (unique per coach+slot), then opens Stripe checkout. Returns the checkout URL
 * for the caller to redirect to. Throws BookingError with a friendly message on any gate.
 */
export async function startSlotBooking(params: {
  offeringId: string
  studentUserId: string
  slotStart: Date
  policyAckAt: Date
  now?: Date
}): Promise<{ url: string }> {
  const now = params.now ?? new Date()

  const offering = await db.query.coachOfferings.findFirst({
    where: eq(coachOfferings.id, params.offeringId),
  })
  if (!offering || !offering.isActive) throw new BookingError('That session length is no longer offered.')

  const slotEnd = new Date(params.slotStart.getTime() + offering.lengthMinutes * 60_000)

  const open = await isSlotOpen({
    coachUserId: offering.coachId,
    offeringLengthMin: offering.lengthMinutes,
    slotStart: params.slotStart,
    now,
  })
  if (!open) throw new BookingError('That time isn’t available anymore. Please pick another.')

  const student = await db.query.users.findFirst({ where: eq(users.id, params.studentUserId) })
  if (!student) throw new BookingError('Student not found.')
  if (student.id === offering.coachId) throw new BookingError('You cannot book yourself.')

  const link = await getOrCreateLink({
    coachUserId: offering.coachId,
    studentUserId: student.id,
    studentReferredByCoachId: student.referredByCoachId,
  })

  const holdExpiresAt = new Date(now.getTime() + HOLD_MINUTES * 60_000)

  // Clear any stale hold on this exact slot so an abandoned checkout doesn't block it.
  await db
    .delete(sessionHolds)
    .where(
      and(
        eq(sessionHolds.coachId, offering.coachId),
        eq(sessionHolds.slotStart, params.slotStart),
        lt(sessionHolds.expiresAt, now),
      ),
    )

  const [hold] = await db
    .insert(sessionHolds)
    .values({
      coachId: offering.coachId,
      studentId: student.id,
      offeringId: offering.id,
      linkId: link.id,
      slotStart: params.slotStart,
      slotEnd,
      policyAckAt: params.policyAckAt,
      expiresAt: holdExpiresAt,
    })
    .onConflictDoNothing({ target: [sessionHolds.coachId, sessionHolds.slotStart] })
    .returning()

  if (!hold) throw new BookingError('Someone just started booking that time. Please pick another.')

  try {
    const { url, checkoutSessionId } = await createCheckout({
      offeringId: offering.id,
      studentUserId: student.id,
      policyAckAt: params.policyAckAt,
      slotStart: params.slotStart,
      slotEnd,
      holdId: hold.id,
      holdExpiresAt,
    })
    await db
      .update(sessionHolds)
      .set({ stripeCheckoutSessionId: checkoutSessionId })
      .where(eq(sessionHolds.id, hold.id))
    return { url }
  } catch (err) {
    // Free the slot immediately if checkout couldn't start.
    await db.delete(sessionHolds).where(eq(sessionHolds.id, hold.id))
    throw err
  }
}

/**
 * Start checkout for a specific slot the student has picked (and we've held).
 *
 * Uses Stripe Checkout with a DESTINATION CHARGE: application_fee_amount is our commission
 * and transfer_data.destination is the coach's Express account (§10). The chosen slot and
 * the hold id ride along in metadata; `expires_at` is set to the hold expiry so Stripe's
 * checkout window and our slot reservation end together.
 *
 * The sessions row is NOT created here — only the checkout.session.completed webhook proves
 * money moved.
 */
export async function createCheckout(params: {
  offeringId: string
  studentUserId: string
  /** §11 — when the student acknowledged the cancellation policy, before paying. */
  policyAckAt: Date
  slotStart: Date
  slotEnd: Date
  holdId: string
  holdExpiresAt: Date
}): Promise<{ url: string; checkoutSessionId: string }> {
  const offering = await db.query.coachOfferings.findFirst({
    where: eq(coachOfferings.id, params.offeringId),
  })

  if (!offering || !offering.isActive) {
    throw new BookingError('That session length is no longer offered.')
  }

  const coach = await db.query.users.findFirst({ where: eq(users.id, offering.coachId) })
  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, offering.coachId),
  })

  if (!coach || !profile) throw new BookingError('Coach not found.')

  if (profile.status === 'suspended') {
    throw new BookingError('This coach is not currently accepting sessions.')
  }

  if (!profile.stripeAccountId || !profile.stripePayoutsEnabled) {
    throw new BookingError('This coach has not finished setting up payouts yet.')
  }

  const student = await db.query.users.findFirst({ where: eq(users.id, params.studentUserId) })
  if (!student) throw new BookingError('Student not found.')

  if (student.id === coach.id) throw new BookingError('You cannot book yourself.')

  const link = await getOrCreateLink({
    coachUserId: coach.id,
    studentUserId: student.id,
    studentReferredByCoachId: student.referredByCoachId,
  })

  const { commissionCents } = splitAmount(offering.priceCents, link.commissionBps)
  const metadata = sessionMetadata({
    linkId: link.id,
    offeringId: offering.id,
    coachId: coach.id,
    studentId: student.id,
    policyAckAt: params.policyAckAt,
    slotStart: params.slotStart,
    slotEnd: params.slotEnd,
    holdId: params.holdId,
  })

  const checkout = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: student.email,
    // Slot reservation and checkout window end together (Stripe's minimum is 30 min).
    expires_at: Math.floor(params.holdExpiresAt.getTime() / 1000),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: offering.priceCents,
          product_data: {
            name: `${offering.lengthMinutes}-minute session with ${coach.fullName ?? 'your coach'}`,
            description: profile.currentTitle,
          },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: commissionCents,
      transfer_data: { destination: profile.stripeAccountId },
      metadata,
    },
    metadata,
    success_url: `${env.NEXT_PUBLIC_APP_URL}/book/complete?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/coaches/${coach.id}?canceled=1`,
  })

  if (!checkout.url) throw new BookingError('Stripe did not return a checkout URL.')

  return { url: checkout.url, checkoutSessionId: checkout.id }
}

function sessionMetadata(p: {
  linkId: string
  offeringId: string
  coachId: string
  studentId: string
  policyAckAt: Date
  slotStart: Date
  slotEnd: Date
  holdId: string
}): Record<string, string> {
  return {
    linkId: p.linkId,
    offeringId: p.offeringId,
    coachId: p.coachId,
    studentId: p.studentId,
    policyAckAt: p.policyAckAt.toISOString(),
    slotStart: p.slotStart.toISOString(),
    slotEnd: p.slotEnd.toISOString(),
    holdId: p.holdId,
  }
}

/** Any booked/rescheduled session for this coach overlapping [start, end). */
async function hasConflictingBooking(coachId: string, start: Date, end: Date): Promise<boolean> {
  const rows = await db.query.sessions.findMany({
    where: and(eq(sessions.coachId, coachId), inArray(sessions.status, ['booked', 'rescheduled'])),
    columns: { scheduledStart: true, scheduledEnd: true },
  })
  return rows.some(
    (r) => r.scheduledStart && r.scheduledEnd && start < r.scheduledEnd && end > r.scheduledStart,
  )
}

/**
 * Create the session row from a completed checkout, at the chosen time.
 *
 * Normally the slot is still free → the session is created directly as `booked`. If it was
 * taken during checkout (rare — the hold spans it) the session is created `paid_unscheduled`
 * so the student can pick another time and nobody loses money. Either way the hold is
 * released. Idempotent on UNIQUE(stripe_payment_intent_id).
 */
export async function confirmBookingFromCheckout(params: {
  paymentIntentId: string
  amountCents: number
  linkId: string
  offeringId: string
  coachId: string
  studentId: string
  policyAckAt: Date | null
  slotStart: Date | null
  slotEnd: Date | null
  holdId: string | null
}): Promise<{ session: typeof sessions.$inferSelect; created: boolean; booked: boolean }> {
  const link = await db.query.coachStudentLinks.findFirst({
    where: eq(coachStudentLinks.id, params.linkId),
  })
  if (!link) throw new BookingError(`Link ${params.linkId} not found`)

  const { commissionCents, coachPayoutCents } = splitAmount(params.amountCents, link.commissionBps)

  const slotOk =
    Boolean(params.slotStart && params.slotEnd) &&
    !(await hasConflictingBooking(params.coachId, params.slotStart!, params.slotEnd!))

  const [created] = await db
    .insert(sessions)
    .values({
      coachId: params.coachId,
      studentId: params.studentId,
      offeringId: params.offeringId,
      linkId: params.linkId,
      amountCents: params.amountCents,
      commissionCents,
      coachPayoutCents,
      status: slotOk ? 'booked' : 'paid_unscheduled',
      scheduledStart: slotOk ? params.slotStart : null,
      scheduledEnd: slotOk ? params.slotEnd : null,
      stripePaymentIntentId: params.paymentIntentId,
      policyAckAt: params.policyAckAt,
    })
    .onConflictDoNothing({ target: sessions.stripePaymentIntentId })
    .returning()

  // Release the hold whether we won the insert or it was a retry.
  if (params.holdId) {
    await db.delete(sessionHolds).where(eq(sessionHolds.id, params.holdId))
  }

  if (created) return { session: created, created: true, booked: created.status === 'booked' }

  const existing = await db.query.sessions.findFirst({
    where: eq(sessions.stripePaymentIntentId, params.paymentIntentId),
  })
  if (!existing) throw new BookingError('Session row vanished after conflict')
  return { session: existing, created: false, booked: existing.status === 'booked' }
}
