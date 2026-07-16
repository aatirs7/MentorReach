'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { coachProfiles } from '@/db/schema'
import { requireCoach } from '@/lib/auth/guards'
import { calendlyConfigured, findOrgMemberByEmail, inviteToOrganization } from '@/lib/calendly'

export type CoachActionState = { error?: string; success?: string }

/**
 * Connect the coach's calendar (§9).
 *
 * We run one Calendly Teams org; a coach is a host in it. This looks the coach up in the
 * org by email and stores their host URI (calendlyUserUri) — the same capture that used
 * to happen at admin approval, now triggered self-serve.
 *
 * Degrades like every other integration: without Calendly configured it says so, and the
 * "Connect your calendar" checklist item simply stays open. Nothing else breaks.
 */
export async function connectCalendarAction(): Promise<CoachActionState> {
  const { user, profile } = await requireCoach()

  if (!calendlyConfigured()) {
    return {
      error:
        'Calendar connection isn’t switched on yet. We’ll email you when it’s ready — nothing’s needed from you now.',
    }
  }

  try {
    const member = await findOrgMemberByEmail(user.email)

    if (!member) {
      // Not in the org yet: send the invite, then they accept and click again.
      await inviteToOrganization(user.email)
      return {
        error:
          'We’ve invited you to our Calendly org — check your email, accept it, then click Connect again.',
      }
    }

    await db
      .update(coachProfiles)
      .set({ calendlyUserUri: member.uri })
      .where(eq(coachProfiles.id, profile.id))

    revalidatePath('/coach')
    return { success: 'Calendar connected.' }
  } catch (err) {
    console.error('[coach] connect calendar failed', err)
    return { error: 'Couldn’t reach Calendly just now. Please try again shortly.' }
  }
}
