/**
 * Spec §6 — commission attribution. THE ONLY PLACE THIS LOGIC LIVES.
 *
 * Deliberately quarantined: spec §14.1 is an open question with Isaiah. He may come
 * back with a different reading of "determined once at signup" (referred students 20%
 * everywhere? referral decays over time?). Inlined into the booking route, changing
 * that answer is an archaeology exercise. As one pure function with no I/O, it's a
 * one-file diff plus a test update.
 *
 * Pure by contract: no imports, no database, no clock. Do not add any.
 *
 * Hard rule §2.2: this runs ONCE per (coach, student) pair, at the first transaction,
 * and the result is frozen into coach_student_links.commission_bps. It is never
 * re-evaluated per booking. There are no manual overrides. The
 * UNIQUE(coach_id, student_id) constraint enforces that at the database level.
 */

/** 20% — the student was referred by THIS coach's code. */
export const COACH_SOURCED_BPS = 2000

/** 30% — everyone else, permanently. */
export const PLATFORM_SOURCED_BPS = 3000

export type SourcedVia = 'referral' | 'platform'

export type CommissionResolution = {
  commissionBps: number
  sourcedVia: SourcedVia
}

/**
 * Spec §6 binding logic, per the assumption flagged in §14.1:
 *
 *   A referral code identifies exactly one coach, so a referred student is 20% WITH
 *   THAT COACH ONLY. Every other coach they book is 30% (platform-sourced). A student
 *   who signed up with no code is 30% with everyone, permanently.
 *
 * ⚠️ UNCONFIRMED WITH ISAIAH. If he meant something else, this function is the change.
 *
 * @param coachId                   the coach being transacted with
 * @param studentReferredByCoachId  users.referred_by_coach_id, captured at signup and
 *                                  immutable afterwards; null if no code was used
 */
export function resolveCommission({
  coachId,
  studentReferredByCoachId,
}: {
  coachId: string
  studentReferredByCoachId: string | null
}): CommissionResolution {
  const isReferredToThisCoach =
    studentReferredByCoachId !== null && studentReferredByCoachId === coachId

  return isReferredToThisCoach
    ? { commissionBps: COACH_SOURCED_BPS, sourcedVia: 'referral' }
    : { commissionBps: PLATFORM_SOURCED_BPS, sourcedVia: 'platform' }
}

/**
 * Splits a charge into our fee and the coach's payout (spec §10).
 *
 * The payout is DERIVED as (amount − commission) rather than rounded independently.
 * That's deliberate: it's what guarantees the two always sum back to the input, which
 * is what keeps the `sessions_amount_split_balances` CHECK constraint from firing on a
 * rounding cent. Do not "fix" this into two symmetrical Math.round calls.
 *
 * `commissionCents` becomes Stripe's `application_fee_amount` on the destination charge.
 */
export function splitAmount(
  amountCents: number,
  commissionBps: number,
): { commissionCents: number; coachPayoutCents: number } {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error(`amountCents must be a non-negative integer, got ${amountCents}`)
  }
  if (!Number.isInteger(commissionBps) || commissionBps < 0 || commissionBps > 10_000) {
    throw new Error(`commissionBps must be an integer in [0, 10000], got ${commissionBps}`)
  }

  const commissionCents = Math.round((amountCents * commissionBps) / 10_000)

  return { commissionCents, coachPayoutCents: amountCents - commissionCents }
}
