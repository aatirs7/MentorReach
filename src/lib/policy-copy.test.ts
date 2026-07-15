import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cancellationDeadline, formatDeadline, policySentence } from './policy-copy'

describe('cancellationDeadline (spec §11)', () => {
  it('is exactly 24 hours before the session start', () => {
    const start = new Date('2026-06-07T15:00:00Z')
    assert.equal(cancellationDeadline(start).toISOString(), '2026-06-06T15:00:00.000Z')
  })

  it('crosses a month boundary correctly', () => {
    const start = new Date('2026-07-01T09:30:00Z')
    assert.equal(cancellationDeadline(start).toISOString(), '2026-06-30T09:30:00.000Z')
  })

  it('agrees with refundEligibility: at the deadline itself, cancelling is still free', async () => {
    // The deadline is the LAST moment a free cancel works. If these two ever disagree,
    // we would be printing a promise the refund logic doesn't honour.
    const { refundEligibility } = await import('./sessions')
    const start = new Date('2026-06-07T15:00:00Z')
    const deadline = cancellationDeadline(start)

    assert.equal(
      refundEligibility({ scheduledStart: start, now: deadline }).refundable,
      true,
      'cancelling exactly at the printed deadline must be refundable',
    )

    assert.equal(
      refundEligibility({ scheduledStart: start, now: new Date(deadline.getTime() + 1000) })
        .refundable,
      false,
      'one second past the printed deadline must not be refundable',
    )
  })
})

describe('formatDeadline', () => {
  it('renders a real, human-readable timestamp (not a placeholder)', () => {
    const label = formatDeadline(new Date('2026-06-06T15:00:00Z'), 'en-US')
    assert.match(label, /Jun/)
    assert.match(label, /6/)
    assert.doesNotMatch(label, /DEADLINE|undefined|NaN|Invalid/)
  })
})

describe('policySentence (spec §11)', () => {
  it('always states "non-refundable" explicitly, and covers no-shows', () => {
    const s = policySentence('Sat, Jun 6, 3:00 PM')
    assert.match(s, /non-refundable/)
    assert.match(s, /no-shows/)
    assert.match(s, /24 hours before/)
  })

  it('includes the deadline when one is known', () => {
    assert.match(policySentence('Sat, Jun 6, 3:00 PM'), /\(Sat, Jun 6, 3:00 PM\)/)
  })

  it('omits the parenthetical entirely when no deadline exists yet', () => {
    // At checkout there is no session start (payment precedes scheduling, §8), so there
    // is no deadline. It must read as a clean sentence, never "(undefined)".
    const s = policySentence()
    assert.match(s, /24 hours before your session\. After that/)
    assert.doesNotMatch(s, /\(|undefined/)
  })

  it('has no em dashes', () => {
    assert.doesNotMatch(policySentence('x'), /—/)
  })
})
