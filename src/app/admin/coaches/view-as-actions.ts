'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachProfiles } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { clearViewAsCookie, setViewAsCookie } from '@/lib/auth/view-as'

/**
 * Enter read-only "view as coach" for a specific coach. Admin-only; validates the target
 * actually has a coach profile before setting the cookie, then lands on the coach's own
 * dashboard. See src/lib/auth/view-as.ts for how the cookie is (and isn't) trusted.
 */
export async function startViewAsCoach(formData: FormData): Promise<void> {
  await requireAdmin()

  const coachUserId = String(formData.get('coachUserId') ?? '')
  if (!coachUserId) return

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, coachUserId),
    columns: { id: true },
  })
  if (!profile) return

  await setViewAsCookie(coachUserId)
  redirect('/coach')
}

/** Exit view-as and return to the admin roster. */
export async function stopViewAsCoach(): Promise<void> {
  await requireAdmin()
  await clearViewAsCookie()
  redirect('/admin/coaches')
}
