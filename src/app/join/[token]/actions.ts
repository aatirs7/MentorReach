'use server'

import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachInvites } from '@/db/schema'
import { ensureUser, getDbUser } from '@/lib/auth/ensure-user'
import { setRole } from '@/lib/auth/set-role'

export type ClaimState = { error?: string }

/**
 * Claim a coach invite. The signed-in visitor becomes a coach and lands in onboarding.
 *
 * Role handling: a brand-new invitee has no Clerk role yet, so setRole('coach') succeeds.
 * Someone who is already a coach passes through. A student/admin can't be flipped, so we
 * refuse with a clear message rather than silently doing nothing.
 */
export async function claimInvite(token: string): Promise<ClaimState> {
  const user = await ensureUser()
  if (!user) redirect(`/sign-in?redirect_url=/join/${token}`)

  const invite = await db.query.coachInvites.findFirst({ where: eq(coachInvites.token, token) })
  if (!invite || invite.status === 'revoked') {
    return { error: 'This invite is no longer valid.' }
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { error: 'This invite has expired. Ask for a new one.' }
  }
  if (invite.status === 'accepted' && invite.acceptedUserId && invite.acceptedUserId !== user.id) {
    return { error: 'This invite has already been used.' }
  }

  // Make the visitor a coach (no-op error if they already are).
  const result = await setRole('coach')
  const dbUser = await getDbUser()
  const isCoach = result.ok || dbUser?.role === 'coach'

  if (!isCoach) {
    return {
      error:
        'This invite is for a new coach account, but you’re signed in as a different account type. Sign out and use the invite link again to create a coach account.',
    }
  }

  await db
    .update(coachInvites)
    .set({ status: 'accepted', acceptedUserId: user.id, acceptedAt: new Date() })
    .where(and(eq(coachInvites.id, invite.id)))

  redirect('/coach/onboarding')
}
