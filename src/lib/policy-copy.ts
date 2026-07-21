/**
 * Spec §11 cancellation policy, stated in the user's words.
 *
 * The exact strings live here, in ONE place, because they appear on the homepage, at
 * checkout, and in the confirmation email, and the whole point is that a student cannot
 * later claim they were told something different in one of them. Divergent copy is the
 * dispute.
 *
 * Deliberately NOT 'server-only': the checkout block is a client component.
 */

/** The concrete deadline: session start minus the §11 24-hour window. */
export function cancellationDeadline(scheduledStart: Date): Date {
  return new Date(scheduledStart.getTime() - 24 * 60 * 60 * 1000)
}

/**
 * "Sat, Jun 6, 3:00 PM" — the student's own locale and timezone.
 *
 * `timeZone` is deliberately left unset so the runtime uses the viewer's. A deadline
 * shown in the wrong zone is worse than none: it is a written promise we'd then break.
 */
export function formatDeadline(deadline: Date, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(deadline)
}

/**
 * The policy sentence.
 *
 * The deadline is optional because of the §8 ordering: payment happens BEFORE
 * scheduling, so at checkout there is no session start yet and therefore no deadline to
 * compute. Rather than print a placeholder or invent a time, the sentence states the
 * rule and gains the concrete timestamp once one exists (the confirmation email, sent
 * after the student picks a time).
 */
export function policySentence(deadlineLabel?: string): string {
  const when = deadlineLabel ? ` (${deadlineLabel})` : ''
  return (
    `Free cancellation or reschedule until 24 hours before your session${when}. ` +
    `After that, and for no-shows, this session is non-refundable.`
  )
}

export const POLICY_HEADING = 'Cancellation policy'
export const CHECKOUT_HEADING = 'Before you pay'
export const ACK_LABEL = 'I understand the cancellation policy.'

/** Homepage trust block (§11 stated plainly, not euphemistically). */
export const TRUST_BLOCK_TITLE = '24-hour cancellation'
export const TRUST_BLOCK_BODY =
  'Cancel or reschedule free up to 24 hours before your session. Inside 24 hours, and for no-shows, the session is non-refundable. The time was reserved for you, and your mentor is paid for it.'
