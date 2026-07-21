import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessions, users } from '@/db/schema'
import { SessionCanceledEmail } from './email/templates'
import { notify } from './notifications'
import { cancellationStatus, canCancel, refundEligibility, type SessionStatus } from './sessions'
import { stripe } from './stripe'
import { deleteMeeting, zoomConfigured } from './zoom'

/**
 * Spec §10/§11 — cancellation and refund.
 *
 * The single implementation of the cancel path (student/mentor canceling in-app), so the
 * policy can't drift. Deleting the Zoom meeting frees nothing on our side — the slot frees
 * automatically because a canceled session no longer counts as busy — but it tidies up the
 * meeting so a canceled session's link doesn't stay live.
 *
 * §10 assumption, UNCONFIRMED WITH ISAIAH (§14.2): on a late cancel / no-show the mentor
 * KEEPS the payout — that's the point of the penalty. The student forfeits and the mentor
 * is compensated for the held slot. If Isaiah wants it swept back to the platform
 * instead, the change is the `if (refundable)` branch below and nothing else.
 */
export type CancelOutcome = {
  status: SessionStatus
  refunded: boolean
  reason: string
}

export async function cancelSession(params: {
  sessionId: string
  /** Who initiated. 'system' reserved for automated cancels. */
  actorUserId: string | 'system'
  now?: Date
}): Promise<CancelOutcome> {
  const now = params.now ?? new Date()

  const session = await db.query.sessions.findFirst({ where: eq(sessions.id, params.sessionId) })
  if (!session) throw new Error(`Session ${params.sessionId} not found`)

  // Idempotency: Stripe retries webhooks, and a user can double-click Cancel.
  if (!canCancel(session.status as SessionStatus)) {
    return {
      status: session.status as SessionStatus,
      refunded: session.status === 'refunded',
      reason: 'Session was already closed out.',
    }
  }

  if (params.actorUserId !== 'system') {
    const isParty = params.actorUserId === session.studentId || params.actorUserId === session.mentorId
    if (!isParty) throw new Error('Not authorized to cancel this session.')
  }

  // §11: WE decide refund eligibility from timing. No external tool decides it.
  const { refundable, reason } = refundEligibility({
    scheduledStart: session.scheduledStart,
    now,
  })

  const status = cancellationStatus(refundable)

  await db
    .update(sessions)
    .set({ status, canceledAt: now })
    .where(eq(sessions.id, session.id))

  // Tear down the Zoom meeting. Best-effort: our state is already correct, and a Zoom
  // failure must not strand the session in a half-canceled limbo.
  if (session.zoomMeetingId && zoomConfigured()) {
    try {
      await deleteMeeting(session.zoomMeetingId)
    } catch (err) {
      console.error(`[cancel] Zoom meeting delete failed for session ${session.id}`, err)
    }
  }

  if (refundable && session.stripePaymentIntentId) {
    try {
      /**
       * refund_application_fee reverses OUR commission and reverse_transfer claws back
       * the mentor's payout, so a full refund actually unwinds the destination charge
       * rather than leaving us paying the mentor out of pocket (§10).
       */
      await stripe().refunds.create({
        payment_intent: session.stripePaymentIntentId,
        refund_application_fee: true,
        reverse_transfer: true,
        metadata: { sessionId: session.id },
      })
      // Status becomes 'refunded' when charge.refunded confirms — not here. Refunds are
      // async; claiming the money is back before Stripe says so would be a lie to the user.
    } catch (err) {
      console.error(`[cancel] Stripe refund failed for session ${session.id}`, err)
      // Leave it in canceled_free: the refund is owed and visible as pending, rather
      // than silently dropped.
    }
  }

  await notifyBothParties(session, refundable)

  return { status, refunded: refundable, reason }
}

async function notifyBothParties(
  session: typeof sessions.$inferSelect,
  refunded: boolean,
): Promise<void> {
  const [student, mentor] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, session.studentId) }),
    db.query.users.findFirst({ where: eq(users.id, session.mentorId) }),
  ])

  if (!student || !mentor) return

  const startsAt = session.scheduledStart
    ? session.scheduledStart.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })
    : 'an unscheduled slot'

  await Promise.all([
    notify({
      userId: student.id,
      type: 'session_canceled',
      payload: { sessionId: session.id, refunded },
      email: {
        to: student.email,
        subject: 'Your MentorReach session was canceled',
        react: SessionCanceledEmail({
          recipientName: firstName(student.fullName),
          otherPartyName: mentor.fullName ?? 'your mentor',
          startsAt,
          refunded,
        }),
      },
    }),
    notify({
      userId: mentor.id,
      type: 'session_canceled',
      payload: { sessionId: session.id, refunded },
      email: {
        to: mentor.email,
        subject: 'A session was canceled',
        react: SessionCanceledEmail({
          recipientName: firstName(mentor.fullName),
          otherPartyName: student.fullName ?? 'your student',
          startsAt,
          refunded,
        }),
      },
    }),
  ])
}

export function firstName(fullName: string | null): string {
  return fullName?.split(/\s+/)[0] ?? 'there'
}
