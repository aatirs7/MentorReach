import { eq } from 'drizzle-orm'
import { AvailabilityEditor } from './availability-editor'
import { db } from '@/db'
import { coachAvailabilityBlackouts, coachAvailabilityRules } from '@/db/schema'
import { requireCoach } from '@/lib/auth/guards'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Your availability', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/** Coach availability editor (native scheduler). Supports admin read-only view-as. */
export default async function CoachAvailabilityPage() {
  const { user, profile, viewAs } = await requireCoach()

  const [rules, blackouts] = await Promise.all([
    db.query.coachAvailabilityRules.findMany({ where: eq(coachAvailabilityRules.coachId, user.id) }),
    db.query.coachAvailabilityBlackouts.findMany({ where: eq(coachAvailabilityBlackouts.coachId, user.id) }),
  ])

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <div className="text-center">
        <p className="label-mono">Scheduling</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Your availability</h1>
        <p className="mx-auto mt-2 max-w-prose text-slate">
          Set the hours you&rsquo;re open to coach. Students book a Zoom session directly into these
          times, and we create the meeting for you.
        </p>
      </div>

      <div className="mt-8">
        <AvailabilityEditor
          rules={rules.map((r) => ({ id: r.id, weekday: r.weekday, startMinute: r.startMinute, endMinute: r.endMinute }))}
          blackouts={blackouts.map((b) => ({ id: b.id, day: b.day }))}
          settings={{
            timezone: profile.timezone,
            bufferMinutes: profile.bookingBufferMinutes,
            minNoticeHours: profile.minNoticeHours,
            maxBookingsPerDay: profile.maxBookingsPerDay,
          }}
          readOnly={viewAs}
        />
      </div>
    </main>
  )
}
