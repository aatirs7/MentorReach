import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import type { Role } from '@/types/globals'

/**
 * Read the caller's role from the Clerk session token.
 *
 * Reads the TOKEN, not the database: the claim is already in the request, so this costs
 * no round-trip. Neon's `users.role` is a mirror for JOINs and WHEREs, not for gates.
 *
 * ⚠️ Returns undefined for everyone until the Clerk Dashboard claims config is saved —
 * see the note in src/types/globals.d.ts.
 */
export async function getRole(): Promise<Role | undefined> {
  const { sessionClaims } = await auth()
  return sessionClaims?.metadata?.role
}

/**
 * Gate a server component / route handler / server action on role (spec §3).
 *
 * Call as close to the resource as possible — NOT in proxy.ts. Note that Server
 * Functions are POSTs to the route they live on, so proxy matchers can silently stop
 * covering them; always authorize inside the function.
 *
 * ⚠️ Do NOT reach for Clerk's `<Show when={{ role: 'admin' }}>` as an alternative —
 * that checks Clerk ORGANIZATIONS roles, a different system. Ours live in
 * publicMetadata. Organizations are the wrong tool for a two-sided consumer
 * marketplace; adopting them would mean modeling every student as a one-person org.
 */
export async function requireRole(...allowed: Role[]) {
  const { userId, sessionClaims } = await auth()

  if (!userId) redirect('/sign-in')

  const role = sessionClaims?.metadata?.role

  if (!role || !allowed.includes(role)) redirect('/')

  return { userId, role }
}
