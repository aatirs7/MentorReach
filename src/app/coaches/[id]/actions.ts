'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachOfferings } from '@/db/schema'
import { BookingError, startSlotBooking } from '@/lib/booking'
import { requireStudent } from '@/lib/auth/guards'
import { bookingEnabled } from '@/lib/env'
import { getBookableSlots } from '@/lib/scheduling'

export type BookState = { error?: string }

/**
 * Open slots for one offering, as ISO instants. Public read (browsing is public); the
 * transact gate lives in startBooking. The client formats these in the viewer's timezone.
 */
export async function slotsForOffering(offeringId: string): Promise<string[]> {
  const offering = await db.query.coachOfferings.findFirst({
    where: eq(coachOfferings.id, offeringId),
    columns: { coachId: true, lengthMinutes: true, isActive: true },
  })
  if (!offering || !offering.isActive) return []

  const slots = await getBookableSlots({
    coachUserId: offering.coachId,
    offeringLengthMin: offering.lengthMinutes,
    now: new Date(),
  })
  return slots.map((s) => s.toISOString())
}

/**
 * Start a booking for a chosen slot.
 *
 * THIS is where the survey gate lives (the coach list and profile are public). It redirects
 * a signed-out visitor to sign-in and an unfinished student to the survey. The §11 policy
 * ack is captured here, at consent, and carried onto the session via Stripe metadata.
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

  const slotStartRaw = formData.get('slotStart')
  const slotStart = typeof slotStartRaw === 'string' ? new Date(slotStartRaw) : null
  if (!slotStart || Number.isNaN(slotStart.getTime())) {
    return { error: 'Pick a time for your session.' }
  }

  if (formData.get('policyAck') !== 'true') {
    return { error: 'Please confirm you understand the cancellation policy.' }
  }

  const policyAckAt = new Date()

  let url: string
  try {
    const result = await startSlotBooking({
      offeringId,
      studentUserId: student.id,
      slotStart,
      policyAckAt,
    })
    url = result.url
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message }
    console.error('[booking] checkout failed', err)
    return { error: 'Something went wrong starting checkout. You have not been charged.' }
  }

  redirect(url)
}
