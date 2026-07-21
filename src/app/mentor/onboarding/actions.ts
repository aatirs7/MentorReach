'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import type { ZodError } from 'zod'
import { db } from '@/db'
import { mentorProfiles } from '@/db/schema'
import { requireUser, viewingAsMentor } from '@/lib/auth/guards'
import { aboutStepSchema, parsePriceToCents, sessionsStepSchema } from '@/lib/mentor-schema'
import { AGREEMENT_VERSION } from '@/lib/mentor-publish'
import { syncOfferings, uniqueReferralCode } from '@/lib/mentor-writes'

export type OnboardingState = {
  errors?: Record<string, string[]>
  message?: string
}

const READ_ONLY = 'You’re viewing as a mentor (read-only). Exit mentor view to make changes.'

/** Shared guard: onboarding is a mentor-only, write path — admins previewing can't save. */
async function requireEditingMentor(): Promise<
  { ok: true; user: Awaited<ReturnType<typeof requireUser>> } | { ok: false; state: OnboardingState }
> {
  const user = await requireUser()
  if (await viewingAsMentor()) return { ok: false, state: { message: READ_ONLY } }
  if (user.role !== 'mentor') return { ok: false, state: { message: 'Only mentors can do this.' } }
  return { ok: true, user }
}

function flatten(error: ZodError): OnboardingState {
  const flat = error.flatten()
  return {
    errors: {
      ...(flat.fieldErrors as Record<string, string[]>),
      ...(flat.formErrors.length ? { _form: flat.formErrors } : {}),
    },
    message: 'Please fix the highlighted fields.',
  }
}

/** Step 1 — About you. Creates the profile row (industry/currentTitle/bio are NOT NULL). */
export async function saveAboutStep(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const gate = await requireEditingMentor()
  if (!gate.ok) return gate.state
  const { user } = gate

  const parsed = aboutStepSchema.safeParse({
    industry: formData.get('industry'),
    currentTitle: formData.get('currentTitle'),
    bio: formData.get('bio'),
    linkedinUrl: formData.get('linkedinUrl') ?? '',
    employerNote: formData.get('employerNote') ?? '',
    employerVisibility: formData.get('employerVisibility') ?? 'show_name',
    generalTitle: formData.get('generalTitle') ?? '',
  })
  if (!parsed.success) return flatten(parsed.error)

  const v = parsed.data
  const displayEmployerGenerally = v.employerVisibility === 'describe_generally'
  const values = {
    industry: v.industry,
    currentTitle: v.currentTitle,
    bio: v.bio,
    linkedinUrl: v.linkedinUrl || null,
    employerNote: v.employerNote || null,
    displayEmployerGenerally,
    generalTitle: displayEmployerGenerally ? v.generalTitle || null : null,
  }

  const existing = await db.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, user.id),
  })

  if (existing) {
    await db.update(mentorProfiles).set(values).where(eq(mentorProfiles.id, existing.id))
  } else {
    await db.insert(mentorProfiles).values({
      ...values,
      userId: user.id,
      referralCode: await uniqueReferralCode(user.fullName),
    })
  }

  redirect('/mentor/onboarding?step=photo')
}

/** Step 3 — Sessions & pricing. */
export async function saveSessionsStep(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const gate = await requireEditingMentor()
  if (!gate.ok) return gate.state
  const { user } = gate

  const lengths = formData.getAll('lengthMinutes').map(String)
  const offerings = lengths
    .map((len) => ({
      lengthMinutes: len,
      priceCents: parsePriceToCents(String(formData.get(`price_${len}`) ?? '')),
    }))
    .filter((o) => o.priceCents !== null)

  const parsed = sessionsStepSchema.safeParse({ offerings })
  if (!parsed.success) return flatten(parsed.error)

  await syncOfferings(user.id, parsed.data.offerings)
  redirect('/mentor/onboarding?step=calendar')
}

/** Step 6 — Handbook. Captures the typed signature once, like saveMentorProfile does. */
export async function saveHandbookStep(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const gate = await requireEditingMentor()
  if (!gate.ok) return gate.state
  const { user } = gate

  const signedName = String(formData.get('handbookSignedName') ?? '').trim()
  if (!signedName) {
    return { errors: { handbookSignedName: ['Type your full legal name to sign.'] } }
  }

  const existing = await db.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, user.id),
    columns: { id: true, handbookAckAt: true },
  })
  if (!existing) return { message: 'Finish the earlier steps first.' }

  // Sign once — re-visiting never overwrites the original consent.
  if (!existing.handbookAckAt) {
    await db
      .update(mentorProfiles)
      .set({
        handbookAckAt: new Date(),
        handbookSignedName: signedName.slice(0, 120),
        handbookVersion: AGREEMENT_VERSION,
      })
      .where(eq(mentorProfiles.id, existing.id))
  }

  redirect('/mentor/onboarding?step=done')
}

/** Final step — mark the guided flow complete and land on the dashboard. */
export async function finishOnboarding(): Promise<void> {
  const gate = await requireEditingMentor()
  if (!gate.ok) redirect('/mentor')
  const { user } = gate

  await db
    .update(mentorProfiles)
    .set({ onboardingCompletedAt: new Date() })
    .where(eq(mentorProfiles.userId, user.id))

  redirect('/mentor')
}
