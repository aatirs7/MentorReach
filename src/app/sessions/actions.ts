'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { mentorOfferings, sessionNotes, sessions, users } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { firstName, cancelSession } from '@/lib/cancel'
import { formatPrice } from '@/lib/mentor-schema'
import { BookingConfirmedEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'
import { getBookableSlots, isSlotOpen } from '@/lib/scheduling'
import { isScheduled, type SessionStatus } from '@/lib/sessions'
import { updateMeeting, zoomConfigured } from '@/lib/zoom'

export type ActionState = { error?: string; success?: string }

/** Spec §11 — cancel from the dashboard. Policy lives in lib/cancel.ts, not here. */
export async function cancelSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const sessionId = formData.get('sessionId')
  if (typeof sessionId !== 'string') return { error: 'Missing session.' }

  try {
    // cancelSession authorizes the actor against the session's two parties.
    const outcome = await cancelSession({ sessionId, actorUserId: user.id })

    revalidatePath('/sessions')

    return {
      success: outcome.refunded
        ? 'Session canceled. Your refund is on its way, and usually lands in 5 to 10 business days.'
        : 'Session canceled. As it was inside the 24-hour window, it is non-refundable.',
    }
  } catch (err) {
    console.error('[sessions] cancel failed', err)
    return { error: err instanceof Error ? err.message : 'Could not cancel that session.' }
  }
}

/** Open slots to reschedule a session into (its mentor + same length). Party-only. */
export async function rescheduleSlots(sessionId: string): Promise<string[]> {
  const user = await requireUser()
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return []
  if (user.id !== session.studentId && user.id !== session.mentorId) return []

  const offering = await db.query.mentorOfferings.findFirst({ where: eq(mentorOfferings.id, session.offeringId) })
  if (!offering) return []

  const slots = await getBookableSlots({
    mentorUserId: session.mentorId,
    offeringLengthMin: offering.lengthMinutes,
    now: new Date(),
  })
  return slots.map((s) => s.toISOString())
}

/** Move a live session to a new open slot. No refund implication (reschedule ≠ cancel). */
export async function rescheduleSessionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser()

  const sessionId = formData.get('sessionId')
  const slotStartRaw = formData.get('slotStart')
  if (typeof sessionId !== 'string') return { error: 'Missing session.' }
  const slotStart = typeof slotStartRaw === 'string' ? new Date(slotStartRaw) : null
  if (!slotStart || Number.isNaN(slotStart.getTime())) return { error: 'Pick a new time.' }

  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return { error: 'Session not found.' }
  if (user.id !== session.studentId && user.id !== session.mentorId) {
    return { error: 'Not authorized.' }
  }
  if (!isScheduled(session.status as SessionStatus)) {
    return { error: 'Only a booked session can be rescheduled.' }
  }

  const offering = await db.query.mentorOfferings.findFirst({ where: eq(mentorOfferings.id, session.offeringId) })
  if (!offering) return { error: 'Session length not found.' }
  const slotEnd = new Date(slotStart.getTime() + offering.lengthMinutes * 60_000)

  const open = await isSlotOpen({
    mentorUserId: session.mentorId,
    offeringLengthMin: offering.lengthMinutes,
    slotStart,
    now: new Date(),
  })
  if (!open) return { error: 'That time isn’t available. Please pick another.' }

  await db
    .update(sessions)
    .set({ status: 'rescheduled', scheduledStart: slotStart, scheduledEnd: slotEnd, reminderSentAt: null })
    .where(eq(sessions.id, session.id))

  if (session.zoomMeetingId && zoomConfigured()) {
    try {
      await updateMeeting(session.zoomMeetingId, {
        startIso: slotStart.toISOString(),
        durationMin: offering.lengthMinutes,
      })
    } catch (err) {
      console.error(`[reschedule] Zoom update failed for session ${session.id}`, err)
    }
  }

  await notifyRescheduled(session.id, slotStart)
  revalidatePath('/sessions')
  return { success: 'Session rescheduled. We’ve emailed the new time to both of you.' }
}

async function notifyRescheduled(sessionId: string, start: Date): Promise<void> {
  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return
  const [student, mentor, offering] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.studentId) }),
    db.query.users.findFirst({ where: eq(users.id, session.mentorId) }),
    db.query.mentorOfferings.findFirst({ where: eq(mentorOfferings.id, session.offeringId) }),
  ])
  if (!student || !mentor) return

  const startsAt = start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
  const manageUrl = `${env.NEXT_PUBLIC_APP_URL}/sessions`
  const lengthMinutes = offering?.lengthMinutes ?? 0

  await Promise.all([
    notify({
      userId: student.id,
      type: 'booking_confirmed',
      payload: { sessionId: session.id },
      email: {
        to: student.email,
        subject: `Your session with ${mentor.fullName ?? 'your mentor'} was rescheduled`,
        react: BookingConfirmedEmail({
          studentName: firstName(student.fullName),
          mentorName: mentor.fullName ?? 'your mentor',
          lengthMinutes,
          startsAt,
          amount: formatPrice(session.amountCents),
          manageUrl,
          joinUrl: session.zoomJoinUrl ?? undefined,
        }),
      },
    }),
    notify({
      userId: mentor.id,
      type: 'booking_confirmed',
      payload: { sessionId: session.id },
      email: {
        to: mentor.email,
        subject: `A session was rescheduled`,
        react: BookingConfirmedEmail({
          studentName: firstName(mentor.fullName),
          mentorName: student.fullName ?? 'your student',
          lengthMinutes,
          startsAt,
          amount: formatPrice(session.mentorPayoutCents),
          manageUrl,
          joinUrl: session.zoomJoinUrl ?? undefined,
        }),
      },
    }),
  ])
}

/** Spec §12 — mentor leaves a brief post-session note, visible to that student. */
export async function addSessionNote(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const sessionId = formData.get('sessionId')
  const body = formData.get('body')

  if (typeof sessionId !== 'string') return { error: 'Missing session.' }
  if (typeof body !== 'string' || !body.trim()) return { error: 'Write something first.' }
  if (body.length > 5000) return { error: 'That note is too long.' }

  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, sessionId) })
  if (!session) return { error: 'Session not found.' }

  // Only the session's mentor may leave notes on it — not the student, not another mentor.
  if (session.mentorId !== user.id) return { error: 'Only the mentor can leave notes.' }

  await db.insert(sessionNotes).values({
    sessionId,
    mentorId: user.id,
    body: body.trim(),
  })

  revalidatePath('/sessions')

  return { success: 'Note saved. Your student can see it now.' }
}
