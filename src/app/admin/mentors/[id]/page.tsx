import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StatusActions } from '../review-actions'
import { startViewAsMentor } from '../view-as-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { mentorOfferings, mentorProfiles, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { mentorStats } from '@/lib/admin-stats'
import { acceptancesFor, hasCurrentAcceptance } from '@/lib/legal-acceptance'
import { mentorChecklist, isMentorLive } from '@/lib/mentor-publish'
import { formatPrice } from '@/lib/mentor-schema'
import { mentorHasAvailability } from '@/lib/scheduling'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Mentor', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Admin mentor detail: the agreement they signed, their setup/publish state, and their
 * stats — the one place to review a mentor.
 */
export default async function AdminMentorDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const profile = await db.query.mentorProfiles.findFirst({ where: eq(mentorProfiles.userId, id) })
  if (!profile) notFound()

  const [mentor, offerings, stats, hasAvailability] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, id) }),
    db.query.mentorOfferings.findMany({
      where: and(eq(mentorOfferings.mentorId, id), eq(mentorOfferings.isActive, true)),
    }),
    mentorStats(id),
    mentorHasAvailability(id),
  ])

  const publishInput = {
    isSeed: profile.isSeed,
    status: profile.status,
    headshotUrl: profile.headshotUrl,
    currentTitle: profile.currentTitle,
    bio: profile.bio,
    hasActiveOffering: offerings.length > 0,
    hasAvailability,
    stripePayoutsEnabled: profile.stripePayoutsEnabled,
    agreementSigned: await hasCurrentAcceptance(id, 'mentor_agreement'),
  }
  // Full signature record, so admin can see who signed what and when.
  const signatures = await acceptancesFor(id, ['mentor_agreement', 'mentor_handbook'])
  const agreementRecord = signatures.get('mentor_agreement')
  const live = isMentorLive(publishInput)
  const suspended = profile.status === 'suspended'
  const checklist = mentorChecklist(publishInput)

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-14">
      <Link
        href="/admin/mentors"
        className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
      >
        ← All mentors
      </Link>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl leading-tight">{mentor?.fullName ?? 'Unnamed mentor'}</h1>
          <p className="mt-1 text-slate">{profile.currentTitle}</p>
          <p className="text-sm text-slate">{mentor?.email}</p>
        </div>
        <Badge variant={suspended ? 'destructive' : live ? 'default' : 'secondary'}>
          {suspended ? 'suspended' : live ? 'live' : 'incomplete'}
        </Badge>
      </div>

      {/* Preview the mentor's own experience, read-only. */}
      <form action={startViewAsMentor} className="mt-4">
        <input type="hidden" name="mentorUserId" value={id} />
        <Button type="submit" variant="outline" size="sm">
          View as this mentor
        </Button>
      </form>

      {/* Agreement review */}
      <Card className="mt-8 border-line/20 p-6">
        <p className="label-mono">Mentor agreement</p>
        {agreementRecord ? (
          <div className="mt-3 space-y-1 text-sm">
            <p>
              Signed by{' '}
              <span className="font-medium text-ink">{agreementRecord.signatureName ?? '—'}</span>
            </p>
            <p className="text-slate">
              {agreementRecord.acceptedAt.toLocaleString('en-US', {
                dateStyle: 'long',
                timeStyle: 'short',
              })}{' '}
              · version {agreementRecord.documentVersion} · {agreementRecord.method}
            </p>
            {/*
             * The content hash is what makes this a record of WHAT was agreed to rather
             * than merely that something was. Shown truncated; the full value is in the
             * export.
             */}
            <p className="pt-1 font-mono text-[11px] break-all text-slate">
              {agreementRecord.contentHash.slice(0, 40)}…
            </p>
            {!publishInput.agreementSigned ? (
              <p className="pt-1 text-destructive">
                This is an older version. They are unpublished until they re-sign.
              </p>
            ) : null}
            <Link
              href="/legal/mentor-agreement"
              className="inline-block pt-1 text-slate underline decoration-gold underline-offset-4 hover:text-ink"
            >
              View the agreement
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate">Not signed yet.</p>
        )}
      </Card>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Sessions completed" value={String(stats.completed)} />
        <StatTile label="Upcoming" value={String(stats.upcoming)} />
        <StatTile label="Students" value={String(stats.distinctStudents)} />
        <StatTile label="Mentor earnings" value={formatPrice(stats.payoutCents)} />
        <StatTile label="Our commission" value={formatPrice(stats.commissionCents)} />
        <StatTile label="Canceled / refunded" value={String(stats.canceled)} />
      </div>

      {/* Setup / publish state */}
      <Card className="mt-6 border-line/20 p-6">
        <p className="label-mono">Publish checklist</p>
        <ul className="mt-3 space-y-2">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
                  item.done ? 'border-gold bg-gold text-ink' : 'border-line/30 text-slate'
                }`}
              >
                {item.done ? '✓' : ''}
              </span>
              <span className={item.done ? 'text-ink' : 'text-slate'}>{item.label}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Profile */}
      <Card className="mt-6 border-line/20 p-6">
        <p className="label-mono">Profile</p>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate">Field</dt>
            <dd>{profile.industry}</dd>
          </div>
          <div>
            <dt className="text-slate">Rates</dt>
            <dd>
              {offerings.length
                ? offerings
                    .sort((a, b) => a.lengthMinutes - b.lengthMinutes)
                    .map((o) => `${o.lengthMinutes}m ${formatPrice(o.priceCents)}`)
                    .join(' · ')
                : 'None'}
            </dd>
          </div>
          {profile.linkedinUrl ? (
            <div className="sm:col-span-2">
              <dt className="text-slate">LinkedIn</dt>
              <dd>
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline underline-offset-4"
                >
                  {profile.linkedinUrl}
                </a>
              </dd>
            </div>
          ) : null}
          {profile.resumeUrl ? (
            <div className="sm:col-span-2">
              <dt className="text-slate">Resume</dt>
              <dd>
                <a
                  href={profile.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline underline-offset-4"
                >
                  View resume (PDF)
                </a>
              </dd>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-slate">Bio</dt>
            <dd className="mt-0.5 leading-relaxed whitespace-pre-line text-ink/90">{profile.bio}</dd>
          </div>
          {profile.employerNote ? (
            <div className="sm:col-span-2">
              <dt className="text-slate">Employer note</dt>
              <dd className="mt-0.5 text-slate">{profile.employerNote}</dd>
            </div>
          ) : null}
        </dl>

        {live ? (
          <Button asChild size="sm" variant="outline" className="mt-5">
            <Link href={`/mentors/${id}`}>View public profile</Link>
          </Button>
        ) : null}
      </Card>

      <StatusActions profileId={profile.id} suspended={suspended} />
    </main>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-line/20 p-4">
      <p className="label-mono">{label}</p>
      <p className="mt-1.5 font-display text-2xl">{value}</p>
    </Card>
  )
}
