import 'server-only'
import Stripe from 'stripe'
import { env, requireEnv } from './env'

/**
 * Spec §10 — Stripe Connect. MentorReach is the platform; mentors are Express
 * connected accounts.
 *
 * Lazily constructed on purpose: building the client at module scope would throw at
 * import time when STRIPE_SECRET_KEY is absent, which would break `next build` and any
 * page that transitively imports this. Instead the error surfaces only on the one path
 * that actually needs Stripe.
 */
let client: Stripe | null = null

export function stripe(): Stripe {
  if (!client) {
    client = new Stripe(requireEnv('STRIPE_SECRET_KEY', 'Stripe payments'), {
      // Pinned to the version this SDK was built against — silent API drift on a
      // money path is not acceptable. Bump deliberately, alongside the SDK.
      apiVersion: '2026-06-24.dahlia',
      appInfo: { name: 'MentorReach' },
    })
  }
  return client
}

export function stripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY)
}

/**
 * Spec §10 — Express onboarding for a mentor. Surfaced at/after approval.
 * Returns the account id to persist on mentor_profiles.stripe_account_id.
 */
export async function createExpressAccount(params: {
  email: string
  mentorUserId: string
}): Promise<string> {
  const account = await stripe().accounts.create({
    type: 'express',
    email: params.email,
    business_type: 'individual',
    capabilities: {
      transfers: { requested: true },
    },
    metadata: { mentorUserId: params.mentorUserId },
  })

  return account.id
}

/** The hosted onboarding link a mentor follows to finish Express setup. */
export async function createAccountOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${env.NEXT_PUBLIC_APP_URL}/mentor/payouts?refresh=1`,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/mentor/payouts?done=1`,
    type: 'account_onboarding',
  })

  return link.url
}

/** A mentor can only be paid once Stripe says transfers are enabled. */
export async function accountPayoutsReady(accountId: string): Promise<boolean> {
  const account = await stripe().accounts.retrieve(accountId)
  return Boolean(account.charges_enabled && account.payouts_enabled)
}

/** Dashboard link for a mentor to see their own payouts. */
export async function createLoginLink(accountId: string): Promise<string> {
  const link = await stripe().accounts.createLoginLink(accountId)
  return link.url
}
