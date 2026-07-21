'use server'

import { and, eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { mentorInvites } from '@/db/schema'
import { ensureUser, getDbUser } from '@/lib/auth/ensure-user'
import { setRole } from '@/lib/auth/set-role'

export type ClaimState = { error?: string }

/**
 * Claim a mentor invite. The signed-in visitor becomes a mentor and lands in onboarding.
 *
 * Role handling: a brand-new invitee has no Clerk role yet, so setRole('mentor') succeeds.
 * Someone who is already a mentor passes through. A student/admin can't be flipped, so we
 * refuse with a clear message rather than silently doing nothing.
 */
export async function claimInvite(token: string): Promise<ClaimState> {
  const user = await ensureUser()
  if (!user) redirect(`/sign-in?redirect_url=/join/${token}`)

  const invite = await db.query.mentorInvites.findFirst({ where: eq(mentorInvites.token, token) })
  if (!invite || invite.status === 'revoked') {
    return { error: 'This invite is no longer valid.' }
  }
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { error: 'This invite has expired. Ask for a new one.' }
  }
  if (invite.status === 'accepted' && invite.acceptedUserId && invite.acceptedUserId !== user.id) {
    return { error: 'This invite has already been used.' }
  }

  // Make the visitor a mentor (no-op error if they already are).
  const result = await setRole('mentor')
  const dbUser = await getDbUser()
  const isMentor = result.ok || dbUser?.role === 'mentor'

  if (!isMentor) {
    return {
      error:
        'This invite is for a new mentor account, but you’re signed in as a different account type. Sign out and use the invite link again to create a mentor account.',
    }
  }

  await db
    .update(mentorInvites)
    .set({ status: 'accepted', acceptedUserId: user.id, acceptedAt: new Date() })
    .where(and(eq(mentorInvites.id, invite.id)))

  redirect('/mentor/onboarding')
}
