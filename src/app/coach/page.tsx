import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { coachOfferings } from '@/db/schema'
import { requireCoach } from '@/lib/auth/guards'
import { type ChecklistItemKey, coachChecklist, isCoachLive } from '@/lib/coach-publish'
import { formatPrice } from '@/lib/coach-schema'
import { COACH_SOURCED_BPS, PLATFORM_SOURCED_BPS } from '@/lib/commission'
import { coachHasAvailability } from '@/lib/scheduling'
import { env } from '@/lib/env'

export const metadata = { title: 'Your coaching' }

/**
 * The coach's home and self-serve checklist.
 *
 * No approval step: the profile publishes itself the moment every checklist item is done
 * (src/lib/coach-publish.ts). Until then it's simply incomplete, with the remaining items
 * shown here. A suspended coach is offline regardless.
 */
export default async function CoachHome() {
  const { user, profile, viewAs } = await requireCoach()

  // New coaches go through the guided flow first. Admins previewing (view-as) see the
  // dashboard directly, never the wizard.
  if (!profile.onboardingCompletedAt && !viewAs) redirect('/coach/onboarding')

  const offerings = await db.query.coachOfferings.findMany({
    where: eq(coachOfferings.coachId, user.id),
  })
  const active = offerings.filter((o) => o.isActive)
  const hasAvailability = await coachHasAvailability(user.id)

  const publishInput = {
    isSeed: profile.isSeed,
    status: profile.status,
    headshotUrl: profile.headshotUrl,
    currentTitle: profile.currentTitle,
    bio: profile.bio,
    hasActiveOffering: active.length > 0,
    hasAvailability,
    stripePayoutsEnabled: profile.stripePayoutsEnabled,
    handbookAckAt: profile.handbookAckAt,
  }

  const checklist = coachChecklist(publishInput)
  const live = isCoachLive(publishInput)
  const suspended = profile.status === 'suspended'
  const remaining = checklist.filter((c) => !c.done).length

  const referralUrl = `${env.NEXT_PUBLIC_APP_URL}/r/${profile.referralCode}`

  return (
    <main className="flex-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl sm:text-4xl">
              {suspended ? 'Profile paused' : live ? 'You’re live' : 'Almost there'}
            </h1>
            <Badge variant={suspended ? 'destructive' : live ? 'default' : 'secondary'}>
              {suspended ? 'Paused' : live ? 'Live' : `${remaining} to go`}
            </Badge>
          </div>
          <p className="mt-2 max-w-prose text-slate">
            {suspended
              ? 'Your profile isn’t currently visible to students. If you think that’s a mistake, get in touch.'
              : live
                ? 'Students can find and book you. Everything below is done.'
                : `You’re ${remaining} step${remaining === 1 ? '' : 's'} from going live. Finish these and your profile publishes automatically — no waiting on approval.`}
          </p>
        </div>
        <Badge variant="secondary" className="mt-1">
          {profile.industry}
        </Badge>
      </div>

      {!suspended ? (
        <Card className="mt-8 border-line/20 p-6">
          <p className="label-mono">Your checklist</p>
          <ul className="mt-4 space-y-3">
            {checklist.map((item) => (
              <li key={item.key} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    item.done ? 'border-gold bg-gold text-ink' : 'border-line/30 text-slate'
                  }`}
                >
                  {item.done ? '✓' : ''}
                </span>
                <span className={`flex-1 ${item.done ? 'text-ink' : 'text-slate'}`}>
                  {item.label}
                </span>
                {!item.done ? <StepAction stepKey={item.key} /> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border-line/20 p-6">
          <div className="flex items-center justify-between">
            <p className="label-mono">Your sessions</p>
            <Button asChild size="sm" variant="ghost" className="h-auto px-0 text-slate">
              <Link href="/coach/setup">Edit</Link>
            </Button>
          </div>
          <div className="mt-3 space-y-1.5">
            {active.length ? (
              active
                .sort((a, b) => a.lengthMinutes - b.lengthMinutes)
                .map((o) => (
                  <div key={o.id} className="flex justify-between text-sm">
                    <span className="text-slate">{o.lengthMinutes} minutes</span>
                    <span>{formatPrice(o.priceCents)}</span>
                  </div>
                ))
            ) : (
              <p className="text-sm text-slate">None set up yet.</p>
            )}
          </div>
          <Button asChild size="sm" variant="outline" className="mt-5">
            <Link href="/coach/setup">Edit profile &amp; rates</Link>
          </Button>
        </Card>

        <Card className="border-line/20 p-6">
          <p className="label-mono">Your referral link</p>
          <p className="mt-3 text-sm text-slate">
            Students who sign up through this link cost you a lower commission:{' '}
            {PLATFORM_SOURCED_BPS / 100}% drops to {COACH_SOURCED_BPS / 100}% on their sessions
            with you, permanently.
          </p>
          <code className="mt-3 block overflow-x-auto rounded-md border border-line/20 bg-muted px-3 py-2 font-mono text-xs">
            {referralUrl}
          </code>
        </Card>
      </div>
    </main>
  )
}

/** The action a coach takes to complete a still-open checklist item. */
function StepAction({ stepKey }: { stepKey: ChecklistItemKey }) {
  const target: Partial<Record<ChecklistItemKey, { href: string; label: string }>> = {
    photo: { href: '/coach/setup', label: 'Add photo' },
    field: { href: '/coach/setup', label: 'Edit' },
    role: { href: '/coach/setup', label: 'Edit' },
    bio: { href: '/coach/setup', label: 'Edit' },
    offering: { href: '/coach/setup', label: 'Add' },
    calendar: { href: '/coach/availability', label: 'Set hours' },
    payouts: { href: '/coach/payouts', label: 'Set up' },
    handbook: { href: '/coach/setup', label: 'Review' },
  }

  const t = target[stepKey]
  if (!t) return null

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={t.href}>{t.label}</Link>
    </Button>
  )
}
