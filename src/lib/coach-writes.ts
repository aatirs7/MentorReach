import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { coachOfferings, coachProfiles } from '@/db/schema'
import { generateReferralCode } from './auth/referral'

/**
 * Shared coach-profile write helpers, used by both the one-page /coach/setup save
 * (src/app/coach/setup/actions.ts) and the stepped /coach/onboarding saves
 * (src/app/coach/onboarding/actions.ts) so the two can't drift.
 */

/**
 * Offerings are soft-deleted, never removed: sessions.offering_id references them with
 * onDelete: 'restrict', so a hard delete would either fail or orphan session history.
 */
export async function syncOfferings(
  coachUserId: string,
  desired: Array<{ lengthMinutes: number; priceCents: number }>,
) {
  const current = await db.query.coachOfferings.findMany({
    where: eq(coachOfferings.coachId, coachUserId),
  })

  const desiredLengths = desired.map((d) => d.lengthMinutes)

  for (const d of desired) {
    const match = current.find((c) => c.lengthMinutes === d.lengthMinutes)

    if (match) {
      await db
        .update(coachOfferings)
        .set({ priceCents: d.priceCents, isActive: true })
        .where(eq(coachOfferings.id, match.id))
    } else {
      await db.insert(coachOfferings).values({
        coachId: coachUserId,
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
      .update(coachOfferings)
      .set({ isActive: false })
      .where(and(inArray(coachOfferings.id, toRetire), eq(coachOfferings.coachId, coachUserId)))
  }
}

/** referral_code is UNIQUE; retry on the astronomically unlikely collision. */
export async function uniqueReferralCode(fullName: string | null): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode(fullName)
    const taken = await db.query.coachProfiles.findFirst({
      where: eq(coachProfiles.referralCode, code),
      columns: { id: true },
    })
    if (!taken) return code
  }
  throw new Error('Could not generate a unique referral code after 5 attempts')
}
