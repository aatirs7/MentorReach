import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { RolePicker } from './role-picker'
import { requireUser } from '@/lib/auth/guards'
import type { Role } from '@/types/globals'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Choose your path', ...NO_INDEX }

/**
 * Spec §3 — role is chosen at signup and drives everything after.
 *
 * The role is written to Clerk publicMetadata by a server action (never the client), and
 * mirrors into Neon via ensureUser() + the user.updated webhook.
 *
 * The "already chosen?" check reads publicMetadata STRAIGHT FROM CLERK. Not the two
 * obvious alternatives, each of which is wrong here in a way that only shows up in use:
 *
 *  - sessionClaims.metadata.role is undefined until the Clerk Dashboard claims editor is
 *    configured (a dashboard step with no code equivalent), and the token is only
 *    reissued on refresh — so it's stale exactly when this page re-renders after
 *    setRole(). A user who'd already chosen would see the picker again, click, and hit
 *    "Role is already set." Stuck.
 *
 *  - The Neon mirror can't answer this question AT ALL: users.role is NOT NULL and
 *    ensureUser() defaults it to 'student', so "hasn't chosen yet" and "chose student"
 *    are indistinguishable there. Reading the mirror here would redirect every new user
 *    to the survey and make it impossible to sign up as a coach.
 *
 * publicMetadata is the only source that distinguishes unset from set, and it's
 * authoritative and fresh. Guards elsewhere read the mirror, which is correct for THEM:
 * by then a role exists.
 */
export default async function RolePage() {
  await requireUser()

  const clerkUser = await currentUser()
  const chosen = clerkUser?.publicMetadata?.role as Role | undefined

  // Role is set once; don't offer to switch sides of the marketplace.
  if (chosen === 'student') redirect('/onboarding/survey')
  if (chosen === 'coach') redirect('/coach')
  if (chosen === 'admin') redirect('/admin')

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-14">
      {/*
       * Two very low-opacity washes so the ivory isn't a dead flat field behind the
       * cards. No new colors — both are mixes of existing brand tokens, and they sit
       * near the perceptual floor on purpose: this should register as depth, not as a
       * gradient anyone notices.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(56rem 32rem at 50% 6%, color-mix(in oklab, var(--gold) 13%, transparent), transparent 72%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(46rem 28rem at 50% 108%, color-mix(in oklab, var(--line) 8%, transparent), transparent 70%)',
        }}
      />

      <div className="relative mx-auto w-full max-w-4xl">
        <div className="text-center">
          <p className="label-mono">Welcome</p>
          <h1 className="mt-2.5 text-4xl">How will you use MentorReach?</h1>
          <p className="mx-auto mt-3 max-w-md text-slate">
            This shapes your experience on MentorReach. Most people are here to learn.
          </p>
        </div>

        <RolePicker />
      </div>
    </main>
  )
}
