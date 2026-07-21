import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { mentorAvailabilityRules, mentorOfferings, reports, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { ConsoleHeader } from '@/components/console-shell'
import { platformStats } from '@/lib/admin-stats'
import { signedCurrentAgreement } from '@/lib/legal-acceptance'
import { isMentorLive } from '@/lib/mentor-publish'
import { formatPrice } from '@/lib/mentor-schema'
import { bookingEnabled } from '@/lib/env'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Admin', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/** Admin home — the state of the business at a glance, and the way into everything. */
export default async function AdminHome() {
  await requireAdmin()

  const [profiles, activeOfferings, availabilityRules, studentCount, openReports, stats] = await Promise.all([
    db.query.mentorProfiles.findMany(),
    db.select({ mentorId: mentorOfferings.mentorId }).from(mentorOfferings).where(eq(mentorOfferings.isActive, true)),
    db.select({ mentorId: mentorAvailabilityRules.mentorId }).from(mentorAvailabilityRules),
    db.$count(users, eq(users.role, 'student')),
    db.select({ id: reports.id }).from(reports).where(eq(reports.status, 'open')),
    platformStats(),
  ])

  // Live-mentor count via the same rule as browse. Offering + availability presence from sets.
  const mentorsWithOffering = new Set(activeOfferings.map((o) => o.mentorId))
  const mentorsWithAvailability = new Set(availabilityRules.map((r) => r.mentorId))
  const signedIds = await signedCurrentAgreement(profiles.map((p) => p.userId))
  const liveMentors = profiles.filter((p) =>
    isMentorLive({
      isSeed: p.isSeed,
      status: p.status,
      headshotUrl: p.headshotUrl,
      currentTitle: p.currentTitle,
      bio: p.bio,
      hasActiveOffering: mentorsWithOffering.has(p.userId),
      hasAvailability: mentorsWithAvailability.has(p.userId),
      stripePayoutsEnabled: p.stripePayoutsEnabled,
      agreementSigned: signedIds.has(p.userId),
    }),
  ).length
  const signed = profiles.filter((p) => signedIds.has(p.userId)).length

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ConsoleHeader title="Dashboard" description="The state of the business at a glance." />

      {!bookingEnabled() ? (
        <Card className="mt-8 border-gold bg-secondary p-5">
          <p className="text-sm">
            Booking is not live. Payments and/or scheduling aren&rsquo;t configured.{' '}
            <Link href="/admin/integrations" className="underline underline-offset-4">
              See what&rsquo;s missing
            </Link>
            .
          </p>
        </Card>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Live mentors" value={`${liveMentors} / ${profiles.length}`} href="/admin/mentors" />
        <Stat label="Students" value={String(studentCount)} href="/admin/students" />
        <Stat label="Agreements signed" value={String(signed)} href="/admin/mentors" />
        <Stat label="Sessions completed" value={String(stats.completed)} href="/admin/mentors" />
        <Stat label="Commission earned" value={formatPrice(stats.commissionCents)} href="/admin/integrations" />
        <Stat label="Open reports" value={String(openReports.length)} href="/admin/reports" />
      </div>

    </main>
  )
}

function Stat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="border-line/20 p-5 transition-colors hover:border-gold">
        <p className="label-mono">{label}</p>
        <p className="mt-2 font-display text-3xl">{value}</p>
      </Card>
    </Link>
  )
}
