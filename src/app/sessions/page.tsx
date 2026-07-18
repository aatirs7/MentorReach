import { desc, eq, inArray, or } from 'drizzle-orm'
import type { ReactNode } from 'react'
import { SessionCard, type SessionView } from './session-card'
import { CoachShell } from '@/components/coach-shell'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings, sessionNotes, sessions, users } from '@/db/schema'
import { requireUser } from '@/lib/auth/guards'
import { readViewAsCoachId } from '@/lib/auth/view-as'
import { isTerminal, type SessionStatus } from '@/lib/sessions'

export const metadata = { title: 'Your sessions' }

/**
 * Spec §12 — the Coaching Sessions dashboard, for BOTH roles: upcoming + past, with
 * status. One page rather than two: the data is the same shape and only the viewer's
 * side of it changes.
 *
 * For coaches this is one tab of their workspace, so it renders inside the coach sidebar
 * shell. Students see it standalone. When an admin is previewing a coach (view-as), we
 * resolve that coach's id — same rule as requireCoach() — so the sidebar shows AND the
 * sessions are the coach's, not the admin's; the cookie is honored only after auth
 * resolves to an admin here.
 */
export default async function SessionsPage() {
  const me = await requireUser()

  let effectiveUserId = me.id
  let isCoach = me.role === 'coach'
  if (me.role === 'admin') {
    const targetId = await readViewAsCoachId()
    if (targetId) {
      effectiveUserId = targetId
      isCoach = true
    }
  }
  const viewerRole: 'student' | 'coach' = isCoach ? 'coach' : 'student'

  const rows = await db.query.sessions.findMany({
    where: or(eq(sessions.studentId, effectiveUserId), eq(sessions.coachId, effectiveUserId)),
    orderBy: [desc(sessions.scheduledStart), desc(sessions.createdAt)],
  })

  let body: ReactNode

  if (rows.length === 0) {
    body = (
      <>
        <Header viewerRole={viewerRole} align={isCoach ? 'left' : 'center'} />
        <Card className="mt-10 border-line/20 p-10 text-center">
          <p className="text-lg">No sessions yet.</p>
          <p className="mt-2 text-sm text-slate">
            {isCoach
              ? 'Once a student books you, it’ll show up here.'
              : 'Browse coaches and book your first session.'}
          </p>
        </Card>
      </>
    )
  } else {
    // Batch the lookups rather than N+1-ing per card.
    const counterpartyIds = [
      ...new Set(rows.map((r) => (isCoach ? r.studentId : r.coachId))),
    ]
    const offeringIds = [...new Set(rows.map((r) => r.offeringId))]
    const sessionIds = rows.map((r) => r.id)

    const [people, offerings, notes] = await Promise.all([
      db.query.users.findMany({ where: inArray(users.id, counterpartyIds) }),
      db.query.coachOfferings.findMany({ where: inArray(coachOfferings.id, offeringIds) }),
      db.query.sessionNotes.findMany({
        where: inArray(sessionNotes.sessionId, sessionIds),
        orderBy: [desc(sessionNotes.createdAt)],
      }),
    ])

    const personById = new Map(people.map((p) => [p.id, p]))
    const offeringById = new Map(offerings.map((o) => [o.id, o]))

    const views: SessionView[] = rows.map((r) => {
      const counterpartyId = isCoach ? r.studentId : r.coachId
      return {
        id: r.id,
        status: r.status as SessionStatus,
        scheduledStart: r.scheduledStart?.toISOString() ?? null,
        lengthMinutes: offeringById.get(r.offeringId)?.lengthMinutes ?? 0,
        amountCents: r.amountCents,
        payoutCents: r.coachPayoutCents,
        counterpartyName:
          personById.get(counterpartyId)?.fullName ?? (isCoach ? 'Your student' : 'Your coach'),
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
        <Header viewerRole={viewerRole} align={isCoach ? 'left' : 'center'} />

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

  // Coaches get their sessions as a tab inside the workspace sidebar; students standalone.
  if (isCoach) {
    return (
      <CoachShell banner={null}>
        <main className="w-full max-w-3xl flex-1">{body}</main>
      </CoachShell>
    )
  }

  return <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">{body}</main>
}

function Header({
  viewerRole,
  align,
}: {
  viewerRole: 'student' | 'coach'
  align: 'left' | 'center'
}) {
  const centered = align === 'center'
  return (
    <div className={centered ? 'text-center' : undefined}>
      <p className="label-mono">Coaching sessions</p>
      <h1 className="mt-2 text-3xl sm:text-4xl">Your sessions</h1>
      <p className={`mt-2 max-w-prose text-slate ${centered ? 'mx-auto' : ''}`}>
        {viewerRole === 'coach'
          ? 'Everything students have booked with you.'
          : 'Everything you’ve booked. Free cancellation up to 24 hours before.'}
      </p>
    </div>
  )
}
