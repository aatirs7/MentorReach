import { isPlaceholderImage } from './headshot'

/**
 * Mentor publish model (self-serve, no approval gate).
 *
 * A real mentor's profile publishes itself the moment the checklist below is complete —
 * there is no manual admin approval. `status === 'suspended'` is the only thing an admin
 * can do to take a mentor offline; nothing blocks initial go-live.
 *
 * Seed/demo mentors (is_seed) are exempt from the checklist: they exist to populate
 * browse for the demo, so they're live unless suspended. This is why the check has an
 * is_seed carve-out rather than requiring seed rows to carry fake Stripe/Zoom state.
 *
 * Pure logic, no I/O — used by the mentor dashboard checklist, browse, and the booking
 * gate, so they can't disagree about whether a mentor is live.
 */
export type MentorPublishInput = {
  isSeed: boolean
  status: 'pending' | 'approved' | 'suspended'
  headshotUrl: string | null
  currentTitle: string | null
  bio: string | null
  hasActiveOffering: boolean
  /** True when the mentor has set at least one native availability rule (§9 scheduler). */
  hasAvailability: boolean
  stripePayoutsEnabled: boolean
  /**
   * A signed Mentor Agreement at the CURRENT version.
   *
   * A boolean rather than a timestamp, and current-version rather than ever-signed, so a
   * version bump automatically unpublishes everyone who has only signed the old one.
   * That is the intended behaviour: the profile is live on the strength of an agreement,
   * and if the agreement changed, the basis for being live changed with it. Profile data
   * is untouched — they re-sign and go straight back up.
   *
   * Replaces the old `handbookAckAt`, which recorded only that something was acknowledged
   * at some point, with no record of what it said.
   */
  agreementSigned: boolean
}

/**
 * Does the mentor have a REAL photo (not just any URL)?
 *
 * For a real mentor this must be a genuine uploaded image, never a placeholder host — the
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
  | 'agreement'

export type ChecklistItem = {
  key: ChecklistItemKey
  label: string
  done: boolean
}

/** The publish checklist for a REAL mentor, in the order a mentor should work through it. */
export function mentorChecklist(input: MentorPublishInput): ChecklistItem[] {
  return [
    { key: 'photo', label: 'Upload a photo of yourself', done: hasRealPhoto(input.headshotUrl, input.isSeed) },
    { key: 'field', label: 'Choose your field', done: true }, // industry is required at setup, never null
    { key: 'role', label: 'Add your current role', done: Boolean(input.currentTitle?.trim()) },
    { key: 'bio', label: 'Write your bio', done: Boolean(input.bio?.trim()) },
    { key: 'offering', label: 'Set at least one session length and price', done: input.hasActiveOffering },
    { key: 'calendar', label: 'Set your availability', done: input.hasAvailability },
    { key: 'payouts', label: 'Set up payouts with Stripe', done: input.stripePayoutsEnabled },
    { key: 'agreement', label: 'Sign the Mentor Agreement', done: input.agreementSigned },
  ]
}

/** Every checklist item done. Ignores suspension — that's a separate axis. */
export function isProfileComplete(input: MentorPublishInput): boolean {
  return mentorChecklist(input).every((item) => item.done)
}

/**
 * Is this mentor live and bookable right now?
 *
 * suspended → never. seed → yes unless suspended (demo data). real → complete checklist.
 */
export function isMentorLive(input: MentorPublishInput): boolean {
  if (input.status === 'suspended') return false
  if (input.isSeed) return true
  return isProfileComplete(input)
}

/** What's left, for the dashboard. */
export function remainingSteps(input: MentorPublishInput): ChecklistItem[] {
  return mentorChecklist(input).filter((item) => !item.done)
}
