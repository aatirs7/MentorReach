import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { type MentorPublishInput, hasRealPhoto, isMentorLive, isProfileComplete } from './mentor-publish'

/** A real mentor with EVERYTHING done. */
const complete: MentorPublishInput = {
  isSeed: false,
  status: 'approved',
  headshotUrl: 'https://abc123.public.blob.vercel-storage.com/mentors/x.jpg',
  currentTitle: 'Analyst at Evercore',
  bio: 'A real bio.',
  hasActiveOffering: true,
  hasAvailability: true,
  stripePayoutsEnabled: true,
  handbookAckAt: new Date(),
}

describe('isMentorLive — the self-serve publish gate', () => {
  it('publishes a real mentor the moment the whole checklist is done', () => {
    assert.equal(isMentorLive(complete), true)
    assert.equal(isProfileComplete(complete), true)
  })

  it('does NOT publish a real mentor with no photo (acceptance criterion)', () => {
    assert.equal(isMentorLive({ ...complete, headshotUrl: null }), false)
  })

  it('does NOT accept a placeholder face as a real mentor’s photo', () => {
    // The is_seed guardrail: a pravatar URL on a real profile is "no photo".
    const withFakeFace = { ...complete, headshotUrl: 'https://i.pravatar.cc/400?u=x' }
    assert.equal(hasRealPhoto(withFakeFace.headshotUrl, false), false)
    assert.equal(isMentorLive(withFakeFace), false)
  })

  it('holds back on each missing piece', () => {
    assert.equal(isMentorLive({ ...complete, hasActiveOffering: false }), false)
    assert.equal(isMentorLive({ ...complete, hasAvailability: false }), false)
    assert.equal(isMentorLive({ ...complete, stripePayoutsEnabled: false }), false)
    assert.equal(isMentorLive({ ...complete, handbookAckAt: null }), false)
    assert.equal(isMentorLive({ ...complete, bio: '' }), false)
    assert.equal(isMentorLive({ ...complete, currentTitle: '' }), false)
  })

  it('suspended is never live, even when complete', () => {
    assert.equal(isMentorLive({ ...complete, status: 'suspended' }), false)
  })

  it('a seed mentor is live unless suspended, with no checklist and a placeholder face', () => {
    const seed: MentorPublishInput = {
      ...complete,
      isSeed: true,
      headshotUrl: 'https://i.pravatar.cc/400?u=seed',
      hasAvailability: false,
      stripePayoutsEnabled: false,
      handbookAckAt: null,
    }
    assert.equal(isMentorLive(seed), true)
    assert.equal(isMentorLive({ ...seed, status: 'suspended' }), false)
  })
})

describe('hasRealPhoto', () => {
  it('accepts a seed placeholder only on a seed row', () => {
    assert.equal(hasRealPhoto('https://i.pravatar.cc/400?u=x', true), true)
    assert.equal(hasRealPhoto('https://i.pravatar.cc/400?u=x', false), false)
  })
  it('accepts a real uploaded photo on a real row', () => {
    assert.equal(hasRealPhoto('https://x.public.blob.vercel-storage.com/a.jpg', false), true)
  })
  it('is false with no url', () => {
    assert.equal(hasRealPhoto(null, false), false)
    assert.equal(hasRealPhoto(null, true), false)
  })
})
