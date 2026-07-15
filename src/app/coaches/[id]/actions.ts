'use server'

import { redirect } from 'next/navigation'
import { BookingError, createCheckout } from '@/lib/booking'
import { requireStudent } from '@/lib/auth/guards'
import { bookingEnabled } from '@/lib/env'

export type BookState = { error?: string }

/**
 * Spec §8 — start a booking.
 *
 * requireStudent() enforces §2.3 here as well as on the page: a Server Action is a POST
 * to whatever route it lives on, so it must authorize itself rather than trust that the
 * page did.
 */
export async function startBooking(_prev: BookState, formData: FormData): Promise<BookState> {
  const student = await requireStudent()

  if (!bookingEnabled()) {
    return {
      error:
        'Booking isn’t switched on yet. Payments and scheduling are still being configured, and nothing was charged.',
    }
  }

  const offeringId = formData.get('offeringId')
  if (typeof offeringId !== 'string' || !offeringId) {
    return { error: 'Pick a session length first.' }
  }

  /**
   * §11 acknowledgment, re-checked server-side. The pay button is disabled without it,
   * but a disabled button is a UX affordance, not enforcement — this POST can be replayed
   * without ever rendering the form. The timestamp is captured HERE, at the moment of
   * consent, and carried onto the session row via Stripe metadata; it is the evidence
   * that the terms were shown before any money moved.
   */
  if (formData.get('policyAck') !== 'true') {
    return { error: 'Please confirm you understand the cancellation policy.' }
  }

  const policyAckAt = new Date()

  let url: string
  try {
    const result = await createCheckout({
      offeringId,
      studentUserId: student.id,
      policyAckAt,
    })
    url = result.url
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message }
    console.error('[booking] checkout failed', err)
    return { error: 'Something went wrong starting checkout. You have not been charged.' }
  }

  // Outside the try: redirect() throws a control-flow signal that must not be caught.
  redirect(url)
}
