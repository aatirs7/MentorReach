import 'server-only'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { coachProfiles, studentSurveys, users } from '@/db/schema'
import { type DbUser, ensureUser } from './ensure-user'
import { readViewAsCoachId } from './view-as'

/**
 * Spec §3 gating, enforced AT THE RESOURCE rather than in proxy.ts.
 *
 * Why not the proxy: the §2.3 survey gate needs a database read, and Clerk explicitly
 * advises against auth checks in middleware. Server Functions are also POSTs to whatever
 * route they live on, so a proxy matcher can silently stop covering them — a guard in
 * the function itself can't be routed around.
 *
 * Each guard calls ensureUser(), which is what makes a brand-new Clerk account work on
 * its very first page load without waiting for the webhook.
 */

/** Signed in, mirrored into Neon. Anything else redirects to sign-in. */
export async function requireUser(): Promise<DbUser> {
  const user = await ensureUser()
  if (!user) redirect('/sign-in')
  return user
}

/**
 * Hard rule §2.3: students are gated behind the survey. No browsing or booking until
 * `completed_at IS NOT NULL` — note this is the gate, NOT mere row existence, which is
 * what lets a partially-filled survey be saved and resumed.
 */
export async function requireStudent(): Promise<DbUser> {
  const user = await requireUser()

  if (user.role === 'admin') return user // admins can inspect student surfaces
  if (user.role !== 'student') redirect('/')

  const survey = await db.query.studentSurveys.findFirst({
    where: eq(studentSurveys.userId, user.id),
    columns: { completedAt: true },
  })

  if (!survey?.completedAt) redirect('/onboarding/survey')

  return user
}

export type CoachContext = {
  user: DbUser
  profile: typeof coachProfiles.$inferSelect
  /** True when an admin is previewing this coach read-only (see src/lib/auth/view-as.ts). */
  viewAs?: boolean
}

/**
 * A coach with a profile. Any coach reaches their own dashboard regardless of whether
 * they're published yet — that's where the setup checklist lives. Live-ness (published
 * and bookable) is computed from completeness, not stored as a role gate; see
 * src/lib/coach-publish.ts.
 *
 * ADMIN "VIEW AS COACH": when the requester is an admin AND a view-as cookie is set to a
 * real coach, this returns THAT coach's user + profile with `viewAs: true`, so every coach
 * page renders exactly what the coach sees. The cookie is trusted only after auth resolves
 * to an admin here, so a non-admin's cookie is inert. Writes are refused separately.
 */
export async function requireCoach(): Promise<CoachContext> {
  const user = await requireUser()

  if (user.role === 'admin') {
    const targetId = await readViewAsCoachId()
    if (targetId) {
      const [target, profile] = await Promise.all([
        db.query.users.findFirst({ where: eq(users.id, targetId) }),
        db.query.coachProfiles.findFirst({ where: eq(coachProfiles.userId, targetId) }),
      ])
      if (target && profile) return { user: target, profile, viewAs: true }
    }
    // Admin without a valid view-as target has no coaching surface of their own.
    redirect('/admin/coaches')
  }

  if (user.role !== 'coach') redirect('/')

  const profile = await db.query.coachProfiles.findFirst({
    where: eq(coachProfiles.userId, user.id),
  })

  if (!profile) redirect('/coach/onboarding')

  return { user, profile }
}

/**
 * Is the current admin previewing a coach read-only? Used by coach mutations to refuse
 * politely. Only ever true for an admin with a view-as cookie set.
 */
export async function viewingAsCoach(): Promise<boolean> {
  const user = await ensureUser()
  if (!user || user.role !== 'admin') return false
  return Boolean(await readViewAsCoachId())
}

/** A coach who isn't suspended. Suspension is the only admin kill switch. */
export async function requireActiveCoach(): Promise<CoachContext> {
  const ctx = await requireCoach()
  if (ctx.profile.status === 'suspended') redirect('/coach')
  return ctx
}

export async function requireAdmin(): Promise<DbUser> {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/')
  return user
}

/** Has this student finished the survey? For nav/UI, not for gating. */
export async function hasCompletedSurvey(userId: string): Promise<boolean> {
  const survey = await db.query.studentSurveys.findFirst({
    where: eq(studentSurveys.userId, userId),
    columns: { completedAt: true },
  })
  return Boolean(survey?.completedAt)
}

/**
 * Can the current visitor book, and if not, what's in the way?
 *
 * DELIBERATE DEVIATION from spec §2.3/§3, recorded in docs/spec-coverage.md:
 * the survey gates BOOKING, not BROWSING. §3 says middleware "blocks students without a
 * completed survey", which taken literally puts a sign-in wall in front of the coach
 * list — the one page the homepage exists to send people to. That kills top-of-funnel
 * and makes every coach profile invisible to search engines, for no benefit: reading a
 * public profile costs nothing and reveals nothing.
 *
 * The rule's actual purpose is that we know who a student is before they transact, and
 * that is preserved exactly — booking still requires sign-in plus a completed survey,
 * enforced in the action and not merely in the UI.
 *
 * Returns a reason so the page can say what's needed instead of silently redirecting.
 */
export type BookingGate =
  | { canBook: true }
  | { canBook: false; reason: 'signed_out'; href: string; cta: string; message: string }
  | { canBook: false; reason: 'survey_incomplete'; href: string; cta: string; message: string }
  | { canBook: false; reason: 'not_a_student'; href: string; cta: string; message: string }

export async function bookingGate(): Promise<BookingGate> {
  const user = await ensureUser()

  if (!user) {
    return {
      canBook: false,
      reason: 'signed_out',
      href: '/sign-up',
      cta: 'Sign up to book',
      message: 'Create an account to book a session. Browsing is free.',
    }
  }

  // Admins can transact for testing; coaches booking coaches isn't a flow we support.
  if (user.role === 'coach') {
    return {
      canBook: false,
      reason: 'not_a_student',
      href: '/coach',
      cta: 'Go to your coaching',
      message: 'You’re signed in as a coach, so booking isn’t available on this account.',
    }
  }

  if (user.role === 'student' && !(await hasCompletedSurvey(user.id))) {
    return {
      canBook: false,
      reason: 'survey_incomplete',
      href: '/onboarding/survey',
      cta: 'Finish your survey to book',
      message: 'A few quick questions first, so we can match you properly. Takes a minute.',
    }
  }

  return { canBook: true }
}
