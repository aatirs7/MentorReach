import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { MentorSetupForm } from './setup-form'
import { db } from '@/db'
import { mentorOfferings } from '@/db/schema'
import { requireMentor } from '@/lib/auth/guards'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Edit your profile', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Mentor profile EDIT surface. New mentors are created through the guided flow
 * (/mentor/onboarding); requireMentor() sends a mentor with no profile there. This page is for
 * editing an existing profile all at once, and it supports admin "view as mentor" read-only.
 */
export default async function MentorSetupPage() {
  const { user, profile, viewAs } = await requireMentor()

  const offerings = await db.query.mentorOfferings.findMany({
    where: and(eq(mentorOfferings.mentorId, user.id), eq(mentorOfferings.isActive, true)),
  })

  return (
    <main className="mx-auto w-full max-w-2xl flex-1">
      <div className="text-center">
        <p className="label-mono">Your profile</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Edit your profile</h1>
        <p className="mx-auto mt-2 max-w-prose text-slate">
          {viewAs ? 'Read-only preview of this mentor’s profile.' : 'Changes go live immediately.'}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm text-slate">
          Set the hours you&rsquo;re available on your{' '}
          <Link href="/mentor/availability" className="underline decoration-gold underline-offset-4">
            availability page
          </Link>
          .
        </p>
      </div>

      <MentorSetupForm
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
