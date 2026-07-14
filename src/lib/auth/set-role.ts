'use server'

import { auth, clerkClient } from '@clerk/nextjs/server'
import type { Role } from '@/types/globals'

/**
 * Spec §3 — role selection at signup.
 *
 * Clerk's hosted <SignUp /> has no role field, so the flow is:
 *   sign up → redirect to /onboarding/role → this action → user.updated webhook
 *   mirrors the role into Neon.
 *
 * Phase 0 ships this action only; the picker UI is Phase 1.
 *
 * WHY A SERVER ACTION WRITING publicMetadata, rather than a custom sign-up form
 * stuffing `unsafeMetadata.role`: unsafeMetadata is CLIENT-WRITABLE by design, so it
 * would need server-side re-validation anyway, and it would mean owning a custom
 * sign-up form on day one. This costs less and closes the escalation hole structurally.
 *
 * 'admin' is deliberately NOT assignable here — it is granted only from the Clerk
 * dashboard. A self-service path to admin is exactly the hole this shape exists to
 * close.
 *
 * Note: Server Actions are POSTs to the route they're used on, so a proxy matcher can
 * silently stop covering them. Authorization lives here, in the action itself.
 */
const SELECTABLE_ROLES: readonly Role[] = ['student', 'coach']

export async function setRole(role: Role): Promise<{ ok: true } | { ok: false; error: string }> {
  const { userId } = await auth()

  if (!userId) return { ok: false, error: 'Not signed in.' }

  if (!SELECTABLE_ROLES.includes(role)) {
    return { ok: false, error: 'Invalid role.' }
  }

  const client = await clerkClient()
  const user = await client.users.getUser(userId)

  // Role is chosen once at signup and drives everything after (§3). Don't let a
  // replayed action silently flip an established account to the other side of the
  // marketplace.
  const existing = user.publicMetadata?.role as Role | undefined
  if (existing && SELECTABLE_ROLES.includes(existing)) {
    return { ok: false, error: 'Role is already set.' }
  }

  await client.users.updateUser(userId, {
    publicMetadata: { ...user.publicMetadata, role },
  })

  return { ok: true }
}
