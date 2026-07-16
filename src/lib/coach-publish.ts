import { isPlaceholderImage } from './headshot'

/**
 * Coach publish model (self-serve, no approval gate).
 *
 * A real coach's profile publishes itself the moment the checklist below is complete —
 * there is no manual admin approval. `status === 'suspended'` is the only thing an admin
 * can do to take a coach offline; nothing blocks initial go-live.
 *
 * Seed/demo coaches (is_seed) are exempt from the checklist: they exist to populate
 * browse for the demo, so they're live unless suspended. This is why the check has an
 * is_seed carve-out rather than requiring seed rows to carry fake Stripe/Calendly state.
 *
 * Pure logic, no I/O — used by the coach dashboard checklist, browse, and the booking
 * gate, so they can't disagree about whether a coach is live.
 */
export type CoachPublishInput = {
  isSeed: boolean
  status: 'pending' | 'approved' | 'suspended'
  headshotUrl: string | null
  currentTitle: string | null
  bio: string | null
  hasActiveOffering: boolean
  calendlyUserUri: string | null
  stripePayoutsEnabled: boolean
  handbookAckAt: Date | null
}

/**
 * Does the coach have a REAL photo (not just any URL)?
 *
 * For a real coach this must be a genuine uploaded image, never a placeholder host — the
 * same rule resolveHeadshot() enforces at render. A placeholder URL on a real profile
 * counts as "no photo", so it cannot be used to satisfy the publish requirement.
 */
export function hasRealPhoto(headshotUrl: string | null, isSeed: boolean): boolean {
  if (!headshotUrl) return false
  if (isSeed) return true // seed placeholders are allowed on seed rows only
  return !isPlaceholderImage(headshotUrl)
}

export type ChecklistItemKey =
  | 'photo'
  | 'field'
  | 'role'
  | 'bio'
  | 'offering'
  | 'calendar'
  | 'payouts'
  | 'handbook'

export type ChecklistItem = {
  key: ChecklistItemKey
  label: string
  done: boolean
}

/** The publish checklist for a REAL coach, in the order a coach should work through it. */
export function coachChecklist(input: CoachPublishInput): ChecklistItem[] {
  return [
    { key: 'photo', label: 'Upload a photo of yourself', done: hasRealPhoto(input.headshotUrl, input.isSeed) },
    { key: 'field', label: 'Choose your field', done: true }, // industry is required at setup, never null
    { key: 'role', label: 'Add your current role', done: Boolean(input.currentTitle?.trim()) },
    { key: 'bio', label: 'Write your bio', done: Boolean(input.bio?.trim()) },
    { key: 'offering', label: 'Set at least one session length and price', done: input.hasActiveOffering },
    { key: 'calendar', label: 'Connect your calendar', done: Boolean(input.calendlyUserUri) },
    { key: 'payouts', label: 'Set up payouts with Stripe', done: input.stripePayoutsEnabled },
    { key: 'handbook', label: 'Read and agree to the Coach Handbook', done: Boolean(input.handbookAckAt) },
  ]
}

/** Every checklist item done. Ignores suspension — that's a separate axis. */
export function isProfileComplete(input: CoachPublishInput): boolean {
  return coachChecklist(input).every((item) => item.done)
}

/**
 * Is this coach live and bookable right now?
 *
 * suspended → never. seed → yes unless suspended (demo data). real → complete checklist.
 */
export function isCoachLive(input: CoachPublishInput): boolean {
  if (input.status === 'suspended') return false
  if (input.isSeed) return true
  return isProfileComplete(input)
}

/** What's left, for the dashboard. */
export function remainingSteps(input: CoachPublishInput): ChecklistItem[] {
  return coachChecklist(input).filter((item) => !item.done)
}
