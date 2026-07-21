'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { mentorProfiles } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { clearViewAsCookie, setViewAsCookie } from '@/lib/auth/view-as'

/**
 * Enter read-only "view as mentor" for a specific mentor. Admin-only; validates the target
 * actually has a mentor profile before setting the cookie, then lands on the mentor's own
 * dashboard. See src/lib/auth/view-as.ts for how the cookie is (and isn't) trusted.
 */
export async function startViewAsMentor(formData: FormData): Promise<void> {
  await requireAdmin()

  const mentorUserId = String(formData.get('mentorUserId') ?? '')
  if (!mentorUserId) return

  const profile = await db.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, mentorUserId),
    columns: { id: true },
  })
  if (!profile) return

  await setViewAsCookie(mentorUserId)
  redirect('/mentor')
}

/** Exit view-as and return to the admin roster. */
export async function stopViewAsMentor(): Promise<void> {
  await requireAdmin()
  await clearViewAsCookie()
  redirect('/admin/mentors')
}
