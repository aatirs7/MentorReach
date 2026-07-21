import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { mentorOfferings, sessions, users } from '@/db/schema'
import { requireStudent } from '@/lib/auth/guards'
import { formatPrice } from '@/lib/mentor-schema'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Booking confirmed', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Post-payment confirmation. In the native flow the time was chosen before paying, so a
 * completed checkout is already a booked session — this page just confirms it. The session
 * is created by the checkout.session.completed webhook (a redirect isn't proof of payment),
 * so briefly we may show "confirming" while the webhook lands.
 */
export default async function BookCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ cs?: string; session?: string }>
}) {
  const student = await requireStudent()
  const params = await searchParams

  const session = params.session
    ? await db.query.sessions.findFirst({ where: eq(sessions.id, params.session) })
    : await db.query.sessions.findFirst({
        where: eq(sessions.studentId, student.id),
        orderBy: [desc(sessions.createdAt)],
      })

  if (session && session.studentId !== student.id) {
    return <Problem title="Not found" body="We couldn’t find that session." />
  }

  if (!session) {
    return (
      <Problem
        title="Confirming your payment…"
        body="This usually takes a few seconds. Refresh in a moment. If you were charged, your session is safe and will appear here."
      />
    )
  }

  const [offering, mentor] = await Promise.all([
    db.query.mentorOfferings.findFirst({ where: eq(mentorOfferings.id, session.offeringId) }),
    db.query.users.findFirst({ where: eq(users.id, session.mentorId) }),
  ])
  const mentorName = mentor?.fullName ?? 'your mentor'

  // Safety-net path: the slot was taken during checkout, so nothing is scheduled.
  if (session.status === 'paid_unscheduled') {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
        <p className="label-mono">Payment received</p>
        <h1 className="mt-3 text-4xl">That time was just taken</h1>
        <p className="mt-3 text-slate">
          Someone booked the slot you picked while you were checking out. Your payment is safe —
          because no time was booked, it&rsquo;s fully refundable. Cancel from your sessions for a
          full refund, or reach out and we&rsquo;ll help you rebook.
        </p>
        <Button asChild className="mt-6 self-start">
          <Link href="/sessions">Go to your sessions</Link>
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
      <p className="label-mono">You&rsquo;re booked</p>
      <h1 className="mt-3 text-4xl">See you soon</h1>
      <p className="mt-3 text-slate">
        Your {offering?.lengthMinutes}-minute session with {mentorName} is confirmed. We&rsquo;ve
        emailed you the details and your Zoom link.
      </p>

      <Card className="mt-8 border-line/20 p-6">
        {session.scheduledStart ? (
          <p className="text-sm">
            <span className="text-slate">When: </span>
            {session.scheduledStart.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
          </p>
        ) : null}
        <p className="mt-1 text-sm">
          <span className="text-slate">Paid: </span>
          {formatPrice(session.amountCents)}
        </p>
        {session.zoomJoinUrl ? (
          <Button asChild size="lg" className="mt-5 w-full">
            <a href={session.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
              Join link (Zoom)
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="mt-3 w-full">
          <Link href="/sessions">View your sessions</Link>
        </Button>
      </Card>
    </main>
  )
}

function Problem({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-20">
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-3 text-slate">{body}</p>
      {action ? (
        <Button asChild className="mt-6 self-start">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
    </main>
  )
}
