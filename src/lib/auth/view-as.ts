import 'server-only'
import { cookies } from 'next/headers'

/**
 * Admin-only, READ-ONLY "view as mentor".
 *
 * When a founder clicks "View as this mentor" on /admin/mentors/<id>, we drop this cookie
 * carrying the target mentor's user id. requireMentor() (src/lib/auth/guards.ts) consults it
 * ONLY when the authenticated user is an admin, and then resolves the mentor's own
 * dashboard/onboarding as they'd see it. Writes stay blocked: every mentor mutation checks
 * `role === 'mentor'`, which an admin fails, and additionally refuses politely while a
 * view-as cookie is set.
 *
 * SECURITY: the cookie is never trusted on its own. It is honored only after the request's
 * own auth resolves to an admin (re-checked every request), so a forged cookie from a
 * non-admin — or a mentor who sets it on themselves — is simply ignored. The value is only
 * a user id; there is no write path through this mechanism.
 */
export const VIEW_AS_COOKIE = 'mentorreach_view_as_mentor'

const MAX_AGE = 60 * 60 * 2 // 2 hours — a preview session, not a persistent mode

export async function setViewAsCookie(mentorUserId: string): Promise<void> {
  const jar = await cookies()
  jar.set(VIEW_AS_COOKIE, mentorUserId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: MAX_AGE,
    path: '/',
  })
}

export async function clearViewAsCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(VIEW_AS_COOKIE)
}

/** Raw cookie read. Callers MUST gate on the requester being an admin before trusting it. */
export async function readViewAsMentorId(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(VIEW_AS_COOKIE)?.value ?? null
}
