import { desc, eq, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { ConsoleHeader } from '@/components/console-shell'
import { InvitePanel } from './invite-panel'
import { StatusActions } from './review-actions'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachAvailabilityRules, coachInvites, coachOfferings, coachProfiles, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { inviteUrl } from '@/lib/coach-invite'
import { coachChecklist, isCoachLive } from '@/lib/coach-publish'
import { formatPrice } from '@/lib/coach-schema'

export const metadata = { title: 'Coaches' }
export const dynamic = 'force-dynamic'

/**
 * Admin roster. There's no approval queue anymore — coaches publish themselves once their
 * checklist is complete. This is oversight: who's live, who's still setting up, who's
 * suspended, and a suspend/reinstate control for safety.
 */
export default async function AdminCoachesPage() {
  await requireAdmin()

  const profiles = await db.query.coachProfiles.findMany({
    orderBy: [desc(coachProfiles.createdAt)],
  })

  const [coachUsers, offerings] = profiles.length
    ? await Promise.all([
        db.query.users.findMany({ where: inArray(users.id, profiles.map((p) => p.userId)) }),
        db.query.coachOfferings.findMany({
          where: inArray(coachOfferings.coachId, profiles.map((p) => p.userId)),
        }),
      ])
    : [[], []]

  const userById = new Map(coachUsers.map((u) => [u.id, u]))

  const availabilityRules = profiles.length
    ? await db.query.coachAvailabilityRules.findMany({
        where: inArray(coachAvailabilityRules.coachId, profiles.map((p) => p.userId)),
        columns: { coachId: true },
      })
    : []
  const hasAvailabilityByCoach = new Set(availabilityRules.map((r) => r.coachId))

  const pendingInvites = await db.query.coachInvites.findMany({
    where: eq(coachInvites.status, 'pending'),
    orderBy: [desc(coachInvites.createdAt)],
  })

  const rows = profiles.map((p) => {
    const coachOff = offerings.filter((o) => o.coachId === p.userId && o.isActive)
    const hasAvailability = hasAvailabilityByCoach.has(p.userId)
    const publishInput = {
      isSeed: p.isSeed,
      status: p.status,
      headshotUrl: p.headshotUrl,
      currentTitle: p.currentTitle,
      bio: p.bio,
      hasActiveOffering: coachOff.length > 0,
      hasAvailability,
      stripePayoutsEnabled: p.stripePayoutsEnabled,
      handbookAckAt: p.handbookAckAt,
    }
    return {
      profile: p,
      user: userById.get(p.userId),
      offerings: coachOff,
      hasAvailability,
      live: isCoachLive(publishInput),
      remaining: coachChecklist(publishInput).filter((c) => !c.done),
    }
  })

  const suspended = rows.filter((r) => r.profile.status === 'suspended')
  const live = rows.filter((r) => r.live)
  const incomplete = rows.filter((r) => !r.live && r.profile.status !== 'suspended')

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ConsoleHeader title="Coaches" description="Coaches go live automatically when their checklist is complete. You can suspend anyone for safety." />

      <div className="mt-8">
        <InvitePanel
          pending={pendingInvites.map((inv) => ({
            id: inv.id,
            email: inv.email,
            fullName: inv.fullName,
            url: inviteUrl(inv.token),
            createdAt: inv.createdAt.toISOString(),
          }))}
        />
      </div>

      <Section title="Live" rows={live} empty="No live coaches yet." />
      <Section title="Still setting up" rows={incomplete} empty="Nobody mid-setup." />
      {suspended.length > 0 ? <Section title="Suspended" rows={suspended} empty="" /> : null}
    </main>
  )
}

type Row = {
  profile: typeof coachProfiles.$inferSelect
  user?: typeof users.$inferSelect
  offerings: Array<typeof coachOfferings.$inferSelect>
  hasAvailability: boolean
  live: boolean
  remaining: Array<{ label: string }>
}

function Section({ title, rows, empty }: { title: string; rows: Row[]; empty: string }) {
  return (
    <section className="mt-10">
      <h2 className="text-center text-2xl">
        {title} {rows.length > 0 ? <span className="text-slate">({rows.length})</span> : null}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-slate">{empty}</p>
      ) : (
        <div className="mt-4 space-y-4">
          {rows.map((r) => (
            <CoachRow key={r.profile.id} {...r} />
          ))}
        </div>
      )}
    </section>
  )
}

function CoachRow({ profile, user, offerings, hasAvailability, live, remaining }: Row) {
  const suspended = profile.status === 'suspended'

  return (
    <Card className="border-line/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg leading-snug">
            <Link
              href={`/admin/coaches/${profile.userId}`}
              className="underline decoration-transparent underline-offset-4 transition-colors hover:decoration-gold"
            >
              {user?.fullName ?? 'Unnamed coach'}
            </Link>
          </h3>
          <p className="text-sm text-slate">{profile.currentTitle}</p>
          <p className="text-sm text-slate">{user?.email}</p>
        </div>
        <Badge variant={suspended ? 'destructive' : live ? 'default' : 'secondary'}>
          {suspended ? 'suspended' : live ? 'live' : 'incomplete'}
        </Badge>
      </div>

      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="label-mono">Field</dt>
          <dd className="mt-0.5">{profile.industry}</dd>
        </div>
        <div>
          <dt className="label-mono">Rates</dt>
          <dd className="mt-0.5">
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
            <dt className="label-mono">LinkedIn</dt>
            <dd className="mt-0.5">
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
      </dl>

      {!live && !suspended && remaining.length > 0 ? (
        <p className="mt-4 text-xs text-slate">
          Still to do: {remaining.map((r) => r.label).join(' · ')}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate">
        <span>Photo: {profile.headshotUrl ? 'yes' : 'no'}</span>
        <span>Stripe payouts: {profile.stripePayoutsEnabled ? 'ready' : 'no'}</span>
        <span>Availability: {hasAvailability ? 'set' : 'no'}</span>
        <span>Agreement: {profile.handbookAckAt ? 'signed' : 'not signed'}</span>
        <Link
          href={`/admin/coaches/${profile.userId}`}
          className="ml-auto text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
        >
          Review coach
        </Link>
      </div>

      <StatusActions profileId={profile.id} suspended={suspended} />
    </Card>
  )
}
