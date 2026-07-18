import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { coachInvites } from '@/db/schema'
import { env } from './env'

/** A long, unguessable urlsafe token — the whole security of the invite link. */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function inviteUrl(token: string): string {
  return `${env.NEXT_PUBLIC_APP_URL}/join/${token}`
}

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30

/**
 * Create (or re-create) a coach invite for an email. Any earlier PENDING invite for the
 * same email is revoked first, so there's exactly one live link per person and the roster
 * stays clean. Returns the token and its full URL. Shared by the admin invite panel and
 * the application-accept flow.
 */
export async function createCoachInvite(input: {
  email: string
  fullName?: string | null
  prefillField?: string | null
  prefillTitle?: string | null
  invitedBy?: string | null
}): Promise<{ token: string; url: string }> {
  const email = input.email.trim().toLowerCase()

  await db
    .update(coachInvites)
    .set({ status: 'revoked' })
    .where(and(eq(coachInvites.email, email), eq(coachInvites.status, 'pending')))

  const token = generateInviteToken()
  await db.insert(coachInvites).values({
    email,
    fullName: input.fullName ?? null,
    token,
    prefillField: input.prefillField ?? null,
    prefillTitle: input.prefillTitle ?? null,
    invitedBy: input.invitedBy ?? null,
    expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
  })

  return { token, url: inviteUrl(token) }
}
