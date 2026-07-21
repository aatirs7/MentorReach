import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { mentorOfferings } from '@/db/schema'
import { requireMentor } from '@/lib/auth/guards'
import { hasCurrentAcceptance } from '@/lib/legal-acceptance'
import { type ChecklistItemKey, mentorChecklist, isMentorLive } from '@/lib/mentor-publish'
import { formatPrice } from '@/lib/mentor-schema'
import { MENTOR_SOURCED_BPS, PLATFORM_SOURCED_BPS } from '@/lib/commission'
import { mentorHasAvailability } from '@/lib/scheduling'
import { env } from '@/lib/env'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Your mentoring', ...NO_INDEX }

/**
 * The mentor's home and self-serve checklist.
 *
 * No approval step: the profile publishes itself the moment every checklist item is done
 * (src/lib/mentor-publish.ts). Until then it's simply incomplete, with the remaining items
 * shown here. A suspended mentor is offline regardless.
 */
export default async function MentorHome() {
  const { user, profile, viewAs } = await requireMentor()

  // New mentors go through the guided flow first. Admins previewing (view-as) see the
  // dashboard directly, never the wizard.
  if (!profile.onboardingCompletedAt && !viewAs) redirect('/mentor/onboarding')

  const offerings = await db.query.mentorOfferings.findMany({
    where: eq(mentorOfferings.mentorId, user.id),
  })
  const active = offerings.filter((o) => o.isActive)
  const hasAvailability = await mentorHasAvailability(user.id)

  const publishInput = {
    isSeed: profile.isSeed,
    status: profile.status,
    headshotUrl: profile.headshotUrl,
    currentTitle: profile.currentTitle,
    bio: profile.bio,
    hasActiveOffering: active.length > 0,
    hasAvailability,
    stripePayoutsEnabled: profile.stripePayoutsEnabled,
    agreementSigned: await hasCurrentAcceptance(user.id, 'mentor_agreement'),
  }

  const checklist = mentorChecklist(publishInput)
  const live = isMentorLive(publishInput)
  const suspended = profile.status === 'suspended'
  const remaining = checklist.filter((c) => !c.done).length

  const referralUrl = `${env.NEXT_PUBLIC_APP_URL}/r/${profile.referralCode}`

  return (
    <main className="mx-auto w-full max-w-4xl flex-1">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2.5">
          <h1 className="text-3xl sm:text-4xl">
            {suspended ? 'Profile paused' : live ? 'You’re live' : 'Almost there'}
          </h1>
          <Badge variant={suspended ? 'destructive' : live ? 'default' : 'secondary'}>
            {suspended ? 'Paused' : live ? 'Live' : `${remaining} to go`}
          </Badge>
        </div>
        <p className="mx-auto mt-2 max-w-prose text-slate">
          {suspended
            ? 'Your profile isn’t currently visible to students. If you think that’s a mistake, get in touch.'
            : live
              ? 'Students can find and book you. Everything below is done.'
              : `You’re ${remaining} step${remaining === 1 ? '' : 's'} from going live. Finish these and your profile publishes automatically, with no waiting on approval.`}
        </p>
        <div className="mt-3">
          <Badge variant="secondary">{profile.industry}</Badge>
        </div>
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
              <Link href="/mentor/setup">Edit</Link>
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
            <Link href="/mentor/setup">Edit profile &amp; rates</Link>
          </Button>
        </Card>

        <Card className="border-line/20 p-6">
          <p className="label-mono">Your referral link</p>
          <p className="mt-3 text-sm text-slate">
            Students who sign up through this link cost you a lower commission:{' '}
            {PLATFORM_SOURCED_BPS / 100}% drops to {MENTOR_SOURCED_BPS / 100}% on their sessions
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

/** The action a mentor takes to complete a still-open checklist item. */
function StepAction({ stepKey }: { stepKey: ChecklistItemKey }) {
  const target: Partial<Record<ChecklistItemKey, { href: string; label: string }>> = {
    photo: { href: '/mentor/setup', label: 'Add photo' },
    field: { href: '/mentor/setup', label: 'Edit' },
    role: { href: '/mentor/setup', label: 'Edit' },
    bio: { href: '/mentor/setup', label: 'Edit' },
    offering: { href: '/mentor/setup', label: 'Add' },
    calendar: { href: '/mentor/availability', label: 'Set hours' },
    payouts: { href: '/mentor/payouts', label: 'Set up' },
    agreement: { href: '/mentor/agreement', label: 'Sign' },
  }

  const t = target[stepKey]
  if (!t) return null

  return (
    <Button asChild size="sm" variant="outline">
      <Link href={t.href}>{t.label}</Link>
    </Button>
  )
}
