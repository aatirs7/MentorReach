import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  COACH_SOURCED_BPS,
  PLATFORM_SOURCED_BPS,
  resolveCommission,
  splitAmount,
} from './commission'

const COACH_A = 'coach-aaaa'
const COACH_B = 'coach-bbbb'

describe('resolveCommission (spec §6)', () => {
  it('is 20% when the student was referred by THIS coach', () => {
    assert.deepEqual(resolveCommission({ coachId: COACH_A, studentReferredByCoachId: COACH_A }), {
      commissionBps: COACH_SOURCED_BPS,
      sourcedVia: 'referral',
    })
  })

  it('is 30% with a DIFFERENT coach than the one who referred them', () => {
    // The §14.1 assumption: a referral code identifies exactly one coach, so the 20%
    // applies with that coach only. If Isaiah says otherwise, this test changes.
    assert.deepEqual(resolveCommission({ coachId: COACH_B, studentReferredByCoachId: COACH_A }), {
      commissionBps: PLATFORM_SOURCED_BPS,
      sourcedVia: 'platform',
    })
  })

  it('is 30% when the student signed up with no referral code', () => {
    assert.deepEqual(resolveCommission({ coachId: COACH_A, studentReferredByCoachId: null }), {
      commissionBps: PLATFORM_SOURCED_BPS,
      sourcedVia: 'platform',
    })
  })

  it('is pure — same inputs, same output, no hidden state', () => {
    const args = { coachId: COACH_A, studentReferredByCoachId: COACH_A }
    assert.deepEqual(resolveCommission(args), resolveCommission(args))
  })
})

describe('splitAmount (spec §10)', () => {
  it('splits a 30% charge as documented', () => {
    assert.deepEqual(splitAmount(9999, PLATFORM_SOURCED_BPS), {
      commissionCents: 3000,
      coachPayoutCents: 6999,
    })
  })

  it('splits a 20% charge', () => {
    assert.deepEqual(splitAmount(7500, COACH_SOURCED_BPS), {
      commissionCents: 1500,
      coachPayoutCents: 6000,
    })
  })

  it('never loses or invents a cent — the sessions_amount_split_balances invariant', () => {
    // This is the property the CHECK constraint enforces in Postgres. If payout were
    // rounded independently rather than derived, this fuzz would find the drift.
    for (let amount = 0; amount <= 5000; amount++) {
      for (const bps of [COACH_SOURCED_BPS, PLATFORM_SOURCED_BPS]) {
        const { commissionCents, coachPayoutCents } = splitAmount(amount, bps)
        assert.equal(commissionCents + coachPayoutCents, amount, `drift at ${amount} @ ${bps}bps`)
        assert.ok(commissionCents >= 0 && coachPayoutCents >= 0, `negative at ${amount} @ ${bps}bps`)
        assert.ok(Number.isInteger(commissionCents), `non-integer commission at ${amount}`)
      }
    }
  })

  it('rejects nonsense inputs rather than silently producing garbage money', () => {
    assert.throws(() => splitAmount(-1, PLATFORM_SOURCED_BPS))
    assert.throws(() => splitAmount(10.5, PLATFORM_SOURCED_BPS))
    assert.throws(() => splitAmount(1000, 10_001))
    assert.throws(() => splitAmount(1000, -1))
  })
})
