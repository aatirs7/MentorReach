import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { mentorOfferings, mentorProfiles } from '@/db/schema'
import { generateReferralCode } from './auth/referral'

/**
 * Shared mentor-profile write helpers, used by both the one-page /mentor/setup save
 * (src/app/mentor/setup/actions.ts) and the stepped /mentor/onboarding saves
 * (src/app/mentor/onboarding/actions.ts) so the two can't drift.
 */

/**
 * Offerings are soft-deleted, never removed: sessions.offering_id references them with
 * onDelete: 'restrict', so a hard delete would either fail or orphan session history.
 */
export async function syncOfferings(
  mentorUserId: string,
  desired: Array<{ lengthMinutes: number; priceCents: number }>,
) {
  const current = await db.query.mentorOfferings.findMany({
    where: eq(mentorOfferings.mentorId, mentorUserId),
  })

  const desiredLengths = desired.map((d) => d.lengthMinutes)

  for (const d of desired) {
    const match = current.find((c) => c.lengthMinutes === d.lengthMinutes)

    if (match) {
      await db
        .update(mentorOfferings)
        .set({ priceCents: d.priceCents, isActive: true })
        .where(eq(mentorOfferings.id, match.id))
    } else {
      await db.insert(mentorOfferings).values({
        mentorId: mentorUserId,
        lengthMinutes: d.lengthMinutes,
        priceCents: d.priceCents,
      })
    }
  }

  const toRetire = current
    .filter((c) => !desiredLengths.includes(c.lengthMinutes) && c.isActive)
    .map((c) => c.id)

  if (toRetire.length) {
    await db
      .update(mentorOfferings)
      .set({ isActive: false })
      .where(and(inArray(mentorOfferings.id, toRetire), eq(mentorOfferings.mentorId, mentorUserId)))
  }
}

/** referral_code is UNIQUE; retry on the astronomically unlikely collision. */
export async function uniqueReferralCode(fullName: string | null): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(fullName)
    const taken = await db.query.mentorProfiles.findFirst({
      where: eq(mentorProfiles.referralCode, code),
      columns: { id: true },
    })
    if (!taken) return code
  }
  throw new Error('Could not generate a unique referral code after 5 attempts')
}
