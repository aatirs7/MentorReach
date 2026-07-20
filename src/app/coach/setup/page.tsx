import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { CoachSetupForm } from './setup-form'
import { db } from '@/db'
import { coachOfferings } from '@/db/schema'
import { requireCoach } from '@/lib/auth/guards'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Edit your profile', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Coach profile EDIT surface. New coaches are created through the guided flow
 * (/coach/onboarding); requireCoach() sends a coach with no profile there. This page is for
 * editing an existing profile all at once, and it supports admin "view as coach" read-only.
 */
export default async function CoachSetupPage() {
  const { user, profile, viewAs } = await requireCoach()

  const offerings = await db.query.coachOfferings.findMany({
    where: and(eq(coachOfferings.coachId, user.id), eq(coachOfferings.isActive, true)),
  })

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <div className="text-center">
        <p className="label-mono">Your profile</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Edit your profile</h1>
        <p className="mx-auto mt-2 max-w-prose text-slate">
          {viewAs ? 'Read-only preview of this coach’s profile.' : 'Changes go live immediately.'}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-slate">
          Set the hours you&rsquo;re available on your{' '}
          <Link href="/coach/availability" className="underline decoration-gold underline-offset-4">
            availability page
          </Link>
          .
        </p>
      </div>

      <CoachSetupForm
        existing={{
          industry: profile.industry,
          currentTitle: profile.currentTitle,
          bio: profile.bio,
          headshotUrl: profile.headshotUrl,
          resumeUrl: profile.resumeUrl,
          linkedinUrl: profile.linkedinUrl,
          employerNote: profile.employerNote,
          displayEmployerGenerally: profile.displayEmployerGenerally,
          generalTitle: profile.generalTitle,
          handbookSignedName: profile.handbookSignedName,
          handbookSignedAt: profile.handbookAckAt?.toISOString() ?? null,
          offerings: offerings.map((o) => ({ lengthMinutes: o.lengthMinutes, priceCents: o.priceCents })),
        }}
      />
    </main>
  )
}
