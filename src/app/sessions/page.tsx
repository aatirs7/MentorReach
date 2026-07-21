import { desc, eq, inArray, or } from 'drizzle-orm'
import type { ReactNode } from 'react'
import { SessionCard, type SessionView } from './session-card'
import { MentorShell } from '@/components/mentor-shell'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { mentorOfferings, sessionNotes, sessions, users } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { readViewAsMentorId } from '@/lib/auth/view-as'
import { isTerminal, type SessionStatus } from '@/lib/sessions'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Your sessions', ...NO_INDEX }

/**
 * Spec §12 — the Mentoring Sessions dashboard, for BOTH roles: upcoming + past, with
 * status. One page rather than two: the data is the same shape and only the viewer's
 * side of it changes.
 *
 * For mentors this is one tab of their workspace, so it renders inside the mentor sidebar
 * shell. Students see it standalone. When an admin is previewing a mentor (view-as), we
 * resolve that mentor's id — same rule as requireMentor() — so the sidebar shows AND the
 * sessions are the mentor's, not the admin's; the cookie is honored only after auth
 * resolves to an admin here.
 */
export default async function SessionsPage() {
  const me = await requireUser()

  let effectiveUserId = me.id
  let isMentor = me.role === 'mentor'
  if (me.role === 'admin') {
    const targetId = await readViewAsMentorId()
    if (targetId) {
      effectiveUserId = targetId
      isMentor = true
    }
  }
  const viewerRole: 'student' | 'mentor' = isMentor ? 'mentor' : 'student'

  const rows = await db.query.sessions.findMany({
    where: or(eq(sessions.studentId, effectiveUserId), eq(sessions.mentorId, effectiveUserId)),
    orderBy: [desc(sessions.scheduledStart), desc(sessions.createdAt)],
  })

  let body: ReactNode

  if (rows.length === 0) {
    body = (
      <>
        <Header viewerRole={viewerRole} />
        <Card className="mt-10 border-line/20 p-10 text-center">
          <p className="text-lg">No sessions yet.</p>
          <p className="mt-2 text-sm text-slate">
            {isMentor
              ? 'Once a student books you, it’ll show up here.'
              : 'Browse mentors and book your first session.'}
          </p>
        </Card>
      </>
    )
  } else {
    // Batch the lookups rather than N+1-ing per card.
    const counterpartyIds = [
      ...new Set(rows.map((r) => (isMentor ? r.studentId : r.mentorId))),
    ]
    const offeringIds = [...new Set(rows.map((r) => r.offeringId))]
    const sessionIds = rows.map((r) => r.id)

    const [people, offerings, notes] = await Promise.all([
      db.query.users.findMany({ where: inArray(users.id, counterpartyIds) }),
      db.query.mentorOfferings.findMany({ where: inArray(mentorOfferings.id, offeringIds) }),
      db.query.sessionNotes.findMany({
        where: inArray(sessionNotes.sessionId, sessionIds),
        orderBy: [desc(sessionNotes.createdAt)],
      }),
    ])

    const personById = new Map(people.map((p) => [p.id, p]))
    const offeringById = new Map(offerings.map((o) => [o.id, o]))

    const views: SessionView[] = rows.map((r) => {
      const counterpartyId = isMentor ? r.studentId : r.mentorId
      return {
        id: r.id,
        status: r.status as SessionStatus,
        scheduledStart: r.scheduledStart?.toISOString() ?? null,
        lengthMinutes: offeringById.get(r.offeringId)?.lengthMinutes ?? 0,
        amountCents: r.amountCents,
        payoutCents: r.mentorPayoutCents,
        counterpartyName:
          personById.get(counterpartyId)?.fullName ?? (isMentor ? 'Your student' : 'Your mentor'),
        zoomJoinUrl: r.zoomJoinUrl,
        notes: notes
          .filter((n) => n.sessionId === r.id)
          .map((n) => ({ id: n.id, body: n.body, createdAt: n.createdAt.toISOString() })),
      }
    })

    const upcoming = views.filter((v) => !isTerminal(v.status))
    const past = views.filter((v) => isTerminal(v.status))

    body = (
      <>
        <Header viewerRole={viewerRole} />

        <section className="mt-10">
          <h2 className="text-2xl">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-slate">Nothing coming up.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {upcoming.map((v) => (
                <SessionCard key={v.id} session={v} viewerRole={viewerRole} />
              ))}
            </div>
          )}
        </section>

        {past.length > 0 ? (
          <section className="mt-12">
            <h2 className="text-2xl">Past</h2>
            <div className="mt-4 space-y-4">
              {past.map((v) => (
                <SessionCard key={v.id} session={v} viewerRole={viewerRole} />
              ))}
            </div>
          </section>
        ) : null}
      </>
    )
  }

  // Mentors get their sessions as a tab inside the workspace sidebar; students standalone.
  if (isMentor) {
    return (
      <MentorShell banner={null}>
        <main className="mx-auto w-full max-w-3xl flex-1">{body}</main>
      </MentorShell>
    )
  }

  return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">{body}</main>
}

function Header({ viewerRole }: { viewerRole: 'student' | 'mentor' }) {
  return (
    <div className="text-center">
      <p className="label-mono">Mentoring sessions</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Your sessions</h1>
      <p className="mx-auto mt-2 max-w-prose text-slate">
        {viewerRole === 'mentor'
          ? 'Everything students have booked with you.'
          : 'Everything you’ve booked. Free cancellation up to 24 hours before.'}
      </p>
    </div>
  )
}
