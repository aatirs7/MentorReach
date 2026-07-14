import 'server-only'
import { auth, currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import type { Role } from '@/types/globals'

/**
 * The Clerk → Neon mirror, lazy half.
 *
 * WHY THIS EXISTS ALONGSIDE THE WEBHOOK (src/app/api/webhooks/clerk/route.ts):
 *
 * The webhook alone loses a race that will absolutely happen — Clerk redirects the user
 * into the app the instant signup completes, but `user.created` is a separate HTTP call
 * from Clerk's infrastructure to ours. The first authenticated page load frequently
 * beats it, and every `SELECT … WHERE clerk_id = ?` returns zero rows. It would also
 * make local dev require a tunnel before anyone could sign up on localhost.
 *
 * This function alone fails differently: it's write-once and only fires on an
 * authenticated request, so admin queues can't see a user who hasn't visited, and a
 * role flipped in the Clerk dashboard would never propagate.
 *
 * Together they're safe: UNIQUE(clerk_id) makes the two paths COMMUTATIVE. Whichever
 * arrives first inserts; the other becomes a no-op update. No ordering requirement.
 *
 * Direction is Clerk → Neon, one-way. Clerk is the source of truth; this table is a
 * mirror so we can JOIN/WHERE on role without an API call.
 */
export async function ensureUser() {
  const { userId } = await auth()
  if (!userId) return null

  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, userId) })

  // Fast path: already mirrored. The webhook keeps it fresh, so don't re-read Clerk.
  if (existing) return existing

  // Slow path: first authenticated request, webhook hasn't landed (or never will,
  // on localhost). Pull the full profile and upsert.
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress

  if (!email) {
    throw new Error(`Clerk user ${userId} has no email address; cannot mirror to Neon.`)
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null

  // Role may not be set yet — the user hasn't been through /onboarding/role. Default to
  // 'student' so the NOT NULL column has a value; the role picker overwrites it via
  // Clerk, which then flows back through the webhook.
  const role = (clerkUser.publicMetadata?.role as Role | undefined) ?? 'student'

  const [row] = await db
    .insert(users)
    .values({ clerkId: userId, email, fullName, role })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email, fullName, role },
    })
    .returning()

  return row
}
