import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { sessions } from '@/db/schema'

/** Per-mentor numbers for the admin mentor detail page. */
export type MentorStats = {
  total: number
  completed: number
  upcoming: number
  canceled: number
  distinctStudents: number
  /** Mentor's earnings on COMPLETED sessions (cents). */
  payoutCents: number
  /** Our commission on completed sessions (cents). */
  commissionCents: number
  /** Gross charged on completed sessions (cents). */
  grossCents: number
}

const UPCOMING = new Set(['paid_unscheduled', 'booked', 'rescheduled'])
const CANCELED = new Set(['canceled_free', 'canceled_late', 'refunded'])

export async function mentorStats(mentorUserId: string): Promise<MentorStats> {
  const rows = await db
    .select({
      status: sessions.status,
      studentId: sessions.studentId,
      amountCents: sessions.amountCents,
      payoutCents: sessions.mentorPayoutCents,
      commissionCents: sessions.commissionCents,
    })
    .from(sessions)
    .where(eq(sessions.mentorId, mentorUserId))

  const stats: MentorStats = {
    total: rows.length,
    completed: 0,
    upcoming: 0,
    canceled: 0,
    distinctStudents: new Set(rows.map((r) => r.studentId)).size,
    payoutCents: 0,
    commissionCents: 0,
    grossCents: 0,
  }

  for (const r of rows) {
    if (r.status === 'completed') {
      stats.completed += 1
      stats.payoutCents += r.payoutCents
      stats.commissionCents += r.commissionCents
      stats.grossCents += r.amountCents
    } else if (UPCOMING.has(r.status)) {
      stats.upcoming += 1
    } else if (CANCELED.has(r.status)) {
      stats.canceled += 1
    }
  }

  return stats
}

/** Platform-wide rollup for the admin home. */
export async function platformStats() {
  const rows = await db
    .select({ status: sessions.status, amountCents: sessions.amountCents, commissionCents: sessions.commissionCents })
    .from(sessions)

  let completed = 0
  let grossCents = 0
  let commissionCents = 0
  for (const r of rows) {
    if (r.status === 'completed') {
      completed += 1
      grossCents += r.amountCents
      commissionCents += r.commissionCents
    }
  }

  return { sessions: rows.length, completed, grossCents, commissionCents }
}
