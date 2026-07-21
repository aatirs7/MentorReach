'use server'

import { clerkClient } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { mentorProfiles, reports, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'

export type AdminState = { error?: string; success?: string }

/**
 * Suspend or reinstate a mentor — the ONLY admin lever over a mentor's visibility now that
 * there's no approval gate. `suspended` takes them out of browse and off the booking path
 * immediately; reinstating sets `active`, after which live-ness is once again computed
 * from their completed checklist (src/lib/mentor-publish.ts). Session history is untouched.
 */
export async function setMentorStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  await requireAdmin()

  const profileId = formData.get('profileId')
  const suspend = formData.get('suspend') === 'true'

  if (typeof profileId !== 'string') return { error: 'Missing mentor.' }

  await db
    .update(mentorProfiles)
    // 'approved' here just means "not suspended" — the approval concept is gone.
    .set({ status: suspend ? 'suspended' : 'approved' })
    .where(eq(mentorProfiles.id, profileId))

  revalidatePath('/admin/mentors')

  return { success: suspend ? 'Mentor suspended.' : 'Mentor reinstated.' }
}

/**
 * Spec §12 — "suspend/remove any account", including students.
 *
 * Suspension happens in CLERK, not Neon: Clerk is the source of truth for identity, and
 * banning there kills the session immediately and blocks sign-in. Flipping a column in
 * our mirror would leave the user perfectly able to log in and keep going.
 *
 * A banned mentor is also taken out of browse, since a suspended profile status and a
 * banned account are different levers — this sets both for mentors.
 */
export async function setUserSuspension(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  const admin = await requireAdmin()

  const userId = formData.get('userId')
  const suspend = formData.get('suspend') === 'true'

  if (typeof userId !== 'string') return { error: 'Missing user.' }

  const target = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!target) return { error: 'User not found.' }

  // Don't let an admin lock themselves out, or start an admin-vs-admin ban war.
  if (target.id === admin.id) return { error: 'You cannot suspend your own account.' }
  if (target.role === 'admin') return { error: 'Admins cannot be suspended from here.' }

  try {
    const client = await clerkClient()

    if (suspend) await client.users.banUser(target.clerkId)
    else await client.users.unbanUser(target.clerkId)
  } catch (err) {
    console.error('[admin] Clerk ban/unban failed', err)
    return { error: 'Could not reach Clerk. Nothing was changed.' }
  }

  // Keep the mentor's visibility in step with their account state.
  if (target.role === 'mentor') {
    await db
      .update(mentorProfiles)
      .set({ status: suspend ? 'suspended' : 'pending' })
      .where(eq(mentorProfiles.userId, target.id))
  }

  revalidatePath('/admin/users')

  return {
    success: suspend
      ? `${target.fullName ?? target.email} is suspended and signed out.${
          target.role === 'mentor' ? ' Their profile is no longer bookable.' : ''
        }`
      : `${target.fullName ?? target.email} can sign in again.${
          target.role === 'mentor' ? ' Their profile is back to pending review.' : ''
        }`,
  }
}

/** Spec §12 — work the report queue. */
export async function setReportStatus(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const admin = await requireAdmin()

  const reportId = formData.get('reportId')
  const status = formData.get('status')

  if (typeof reportId !== 'string') return { error: 'Missing report.' }
  if (status !== 'reviewed' && status !== 'actioned' && status !== 'open') {
    return { error: 'Invalid status.' }
  }

  await db
    .update(reports)
    .set({
      status,
      reviewedBy: admin.id,
      reviewedAt: status === 'open' ? null : new Date(),
    })
    .where(eq(reports.id, reportId))

  revalidatePath('/admin/reports')

  return { success: `Report marked ${status}.` }
}
