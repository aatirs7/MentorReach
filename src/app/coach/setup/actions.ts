'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachProfiles } from '@/db/schema'
import { requireUser, viewingAsCoach } from '@/lib/auth/guards'
import { coachProfileSchema, parsePriceToCents } from '@/lib/coach-schema'
import { AGREEMENT_VERSION } from '@/lib/coach-publish'
import { syncOfferings, uniqueReferralCode } from '@/lib/coach-writes'
import { UploadError, uploadHeadshot, uploadResume } from '@/lib/storage'

export type CoachSetupState = {
  errors?: Record<string, string[]>
  message?: string
}

/**
 * Create or update a coach profile.
 *
 * There is NO approval step anymore. Saving these details creates (or updates) the
 * profile; the profile publishes ITSELF once the whole checklist is complete (photo,
 * Calendly, Stripe payouts, handbook — see src/lib/coach-publish.ts). `status` is not
 * set here and stays at its DB default; only an admin ever sets `suspended`.
 *
 * Photo is handled by uploadHeadshotAction, not this form, so re-saving text can never
 * wipe an uploaded photo. That's why headshotUrl is absent from the update below.
 */
export async function saveCoachProfile(
  _prev: CoachSetupState,
  formData: FormData,
): Promise<CoachSetupState> {
  const user = await requireUser()

  if (await viewingAsCoach()) {
    return { message: 'You’re viewing as a coach (read-only). Exit coach view to make changes.' }
  }

  if (user.role !== 'coach') {
    return { message: 'Only coaches can set up a coaching profile.' }
  }

  // Offerings arrive as parallel arrays: a checked length + its price input (in dollars,
  // converted to the integer cents the schema and DB expect).
  const lengths = formData.getAll('lengthMinutes').map(String)
  const offerings = lengths
    .map((len) => ({
      lengthMinutes: len,
      priceCents: parsePriceToCents(String(formData.get(`price_${len}`) ?? '')),
    }))
    .filter((o) => o.priceCents !== null)

  const parsed = coachProfileSchema.safeParse({
    industry: formData.get('industry'),
    currentTitle: formData.get('currentTitle'),
    bio: formData.get('bio'),
    headshotUrl: '', // managed by uploadHeadshotAction; not part of this form
    linkedinUrl: formData.get('linkedinUrl') ?? '',
    employerNote: formData.get('employerNote') ?? '',
    employerVisibility: formData.get('employerVisibility') ?? 'show_name',
    generalTitle: formData.get('generalTitle') ?? '',
    offerings,
  })

  if (!parsed.success) {
    const flat = parsed.error.flatten()
    return {
      errors: {
        ...(flat.fieldErrors as Record<string, string[]>),
        ...(flat.formErrors.length ? { _form: flat.formErrors } : {}),
      },
      message: 'Please fix the highlighted fields.',
    }
  }

  const v = parsed.data
  const existing = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })

  // Handbook agreement — required to publish. The coach types their full legal name to
  // sign; that captures the consent timestamp, the signed name, and the version once.
  // Re-editing the form later never re-signs or overwrites the original signature
  // (consent, like the booking policy ack), so it's reviewable in admin unchanged.
  const signedNameRaw = String(formData.get('handbookSignedName') ?? '').trim()
  const alreadySigned = Boolean(existing?.handbookAckAt)

  const signature =
    alreadySigned || !signedNameRaw
      ? {}
      : {
          handbookAckAt: new Date(),
          handbookSignedName: signedNameRaw.slice(0, 120),
          handbookVersion: AGREEMENT_VERSION,
        }

  const displayEmployerGenerally = v.employerVisibility === 'describe_generally'

  const textValues = {
    industry: v.industry,
    currentTitle: v.currentTitle,
    bio: v.bio,
    linkedinUrl: v.linkedinUrl || null,
    employerNote: v.employerNote || null,
    displayEmployerGenerally,
    generalTitle: displayEmployerGenerally ? v.generalTitle || null : null,
    ...signature,
  }

  if (existing) {
    // Explicit column list: status/approvedAt/approvedBy/referralCode/headshotUrl are
    // deliberately absent — an edit can't change publication state, churn a shared
    // referral code, or wipe an uploaded photo.
    await db.update(coachProfiles).set(textValues).where(eq(coachProfiles.id, existing.id))
  } else {
    await db.insert(coachProfiles).values({
      ...textValues,
      userId: user.id,
      referralCode: await uniqueReferralCode(user.fullName),
    })
  }

  await syncOfferings(user.id, v.offerings)

  redirect('/coach')
}

/**
 * Upload the coach's resume/CV (PDF, Vercel Blob), separately from the text form for the
 * same reason as the headshot. Optional and admin-only visible; not a publish gate.
 */
export async function uploadResumeAction(
  _prev: CoachSetupState,
  formData: FormData,
): Promise<CoachSetupState> {
  const user = await requireUser()
  if (await viewingAsCoach()) {
    return { message: 'You’re viewing as a coach (read-only). Exit coach view to make changes.' }
  }
  if (user.role !== 'coach') return { message: 'Only coaches can upload a resume.' }

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })
  if (!profile) {
    return { message: 'Save your details first, then add a resume.' }
  }

  const file = formData.get('resume')
  if (!(file instanceof File) || file.size === 0) {
    return { errors: { resume: ['Choose a PDF to upload.'] } }
  }

  let url: string
  try {
    url = await uploadResume(user.id, file)
  } catch (err) {
    if (err instanceof UploadError) return { errors: { resume: [err.message] } }
    console.error('[coach-setup] resume upload failed', err)
    return { errors: { resume: ['Upload failed. Please try again.'] } }
  }

  await db.update(coachProfiles).set({ resumeUrl: url }).where(eq(coachProfiles.id, profile.id))

  revalidatePath('/coach/setup')
  revalidatePath('/coach/onboarding')

  return { message: 'Resume saved.' }
}

/**
 * Upload the coach's own headshot (Vercel Blob), separately from the text form so a large
 * image can't take the text save down with it, and vice versa.
 *
 * A real coach MUST upload a photo to publish. This produces a blob URL (never a
 * placeholder host), so it always satisfies hasRealPhoto(); the is_seed guardrail still
 * means a placeholder could never render on a real profile even if one slipped in.
 */
export async function uploadHeadshotAction(
  _prev: CoachSetupState,
  formData: FormData,
): Promise<CoachSetupState> {
  const user = await requireUser()
  if (await viewingAsCoach()) {
    return { message: 'You’re viewing as a coach (read-only). Exit coach view to make changes.' }
  }
  if (user.role !== 'coach') return { message: 'Only coaches can upload a headshot.' }

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })
  if (!profile) {
    return { message: 'Save your details first, then add a photo.' }
  }

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return { errors: { photo: ['Choose a photo to upload.'] } }
  }

  let url: string
  try {
    url = await uploadHeadshot(user.id, file)
  } catch (err) {
    if (err instanceof UploadError) return { errors: { photo: [err.message] } }
    console.error('[coach-setup] headshot upload failed', err)
    return { errors: { photo: ['Upload failed. Please try again.'] } }
  }

  await db.update(coachProfiles).set({ headshotUrl: url }).where(eq(coachProfiles.id, profile.id))

  revalidatePath('/coach/setup')
  revalidatePath('/coach')

  return { message: 'Photo saved.' }
}
