import { and, eq, gte, inArray, isNull, lt, lte } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { sessionHolds, sessions, users } from '@/db/schema'
import { firstName } from '@/lib/cancel'
import { SessionReminderEmail } from '@/lib/email/templates'
import { env } from '@/lib/env'
import { notify } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

/**
 * Scheduled jobs. One endpoint, guarded by CRON_SECRET.
 *
 *   §11 — mark sessions `completed` once scheduled_end has passed.
 *   §1.5 — 24h session reminders (the "automated reminders" item; the 1h variant is a
 *          second schedule against the same handler).
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. In production an unauthorized
 * call 404s rather than 401s — a 401 confirms the endpoint exists, which is free recon.
 */
export async function GET(req: NextRequest) {
  const expected = env.CRON_SECRET

  if (!expected) {
    // Refuse to run unauthenticated. An open endpoint that mutates session state and
    // sends email is not something to leave lying around.
    console.warn('[cron] invoked but CRON_SECRET is not set')
    return new Response('Not found', { status: 404 })
  }

  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return new Response('Not found', { status: 404 })
  }

  const now = new Date()

  const [completed, reminded, holdsSwept] = await Promise.all([
    completeElapsed(now),
    sendReminders(now),
    sweepExpiredHolds(now),
  ])

  return Response.json({ ok: true, now: now.toISOString(), completed, reminded, holdsSwept })
}

/**
 * Delete slot holds whose checkout window has passed (abandoned or expired). A stale hold
 * would otherwise keep a slot looking busy until someone tried to rebook it. Best-effort
 * cleanup; startSlotBooking also clears a stale hold on the exact slot it targets.
 */
async function sweepExpiredHolds(now: Date): Promise<number> {
  const expired = await db.select({ id: sessionHolds.id }).from(sessionHolds).where(lt(sessionHolds.expiresAt, now))
  if (!expired.length) return 0
  await db.delete(sessionHolds).where(inArray(sessionHolds.id, expired.map((h) => h.id)))
  return expired.length
}

/**
 * Spec §11 — `completed` is set after scheduled_end passes, unless canceled.
 *
 * Only `booked`/`rescheduled` are eligible: a canceled or refunded session must never be
 * resurrected into completed, and `paid_unscheduled` never had a time to elapse.
 * Backed by the (status, scheduled_end) index.
 */
async function completeElapsed(now: Date): Promise<number> {
  const due = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        inArray(sessions.status, ['booked', 'rescheduled']),
        lt(sessions.scheduledEnd, now),
      ),
    )

  if (!due.length) return 0

  await db
    .update(sessions)
    .set({ status: 'completed', completedAt: now })
    .where(inArray(sessions.id, due.map((d) => d.id)))

  return due.length
}

/**
 * Spec §12 — the session reminder. Fires for sessions starting within the next 24h.
 *
 * Idempotency is `reminder_sent_at`, NOT the time window: a window-only check re-sends
 * to everyone still inside it on the next hourly tick. The column is claimed before the
 * emails go out, so a slow run overlapping the next one can't double-send either.
 */
async function sendReminders(now: Date): Promise<number> {
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const due = await db.query.sessions.findMany({
    where: and(
      inArray(sessions.status, ['booked', 'rescheduled']),
      gte(sessions.scheduledStart, now),
      lte(sessions.scheduledStart, in24h),
      isNull(sessions.canceledAt),
      isNull(sessions.reminderSentAt),
    ),
  })

  if (!due.length) return 0

  // Claim them FIRST. If the sends fail, the worst case is a missed reminder rather
  // than a duplicate — the better failure for a transactional email.
  await db
    .update(sessions)
    .set({ reminderSentAt: now })
    .where(inArray(sessions.id, due.map((s) => s.id)))

  const peopleIds = [...new Set(due.flatMap((s) => [s.studentId, s.mentorId]))]
  const people = await db.query.users.findMany({ where: inArray(users.id, peopleIds) })
  const byId = new Map(people.map((p) => [p.id, p]))

  let sent = 0

  for (const session of due) {
    const student = byId.get(session.studentId)
    const mentor = byId.get(session.mentorId)
    if (!student || !mentor || !session.scheduledStart) continue

    const startsAt = session.scheduledStart.toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short',
    })

    await Promise.all([
      notify({
        userId: student.id,
        type: 'session_reminder',
        payload: { sessionId: session.id },
        email: {
          to: student.email,
          subject: 'Your session is tomorrow',
          react: SessionReminderEmail({
            recipientName: firstName(student.fullName),
            otherPartyName: mentor.fullName ?? 'your mentor',
            startsAt,
            manageUrl: `${env.NEXT_PUBLIC_APP_URL}/sessions`,
          }),
        },
      }),
      notify({
        userId: mentor.id,
        type: 'session_reminder',
        payload: { sessionId: session.id },
        email: {
          to: mentor.email,
          subject: 'You have a session tomorrow',
          react: SessionReminderEmail({
            recipientName: firstName(mentor.fullName),
            otherPartyName: student.fullName ?? 'your student',
            startsAt,
            manageUrl: `${env.NEXT_PUBLIC_APP_URL}/sessions`,
          }),
        },
      }),
    ])

    sent += 1
  }

  return sent
}

export { eq }
