import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { z } from 'zod'

/**
 * Regression test for the empty-string-vs-absent bug in src/lib/env.ts.
 *
 * This mirrors the `optionalKey()` shape rather than importing env.ts, because that
 * module is 'server-only' and parses the real process.env at import time. The behavior
 * under test is the zod shape itself.
 *
 * Why this test exists: a .env file carries `KEY=""` placeholders for services that
 * aren't set up yet. The obvious spelling — z.string().min(1).optional() — treats "" as
 * present-but-invalid and throws at boot, taking down the whole app because Stripe isn't
 * configured. That is the exact failure this project is built to avoid, and it is
 * invisible until someone has a blank .env line.
 */
const optionalKey = () =>
  z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional())

describe('optionalKey — empty string means "not configured"', () => {
  const schema = z.object({ STRIPE_SECRET_KEY: optionalKey() })

  it('accepts an absent var', () => {
    const r = schema.safeParse({})
    assert.equal(r.success, true)
    assert.equal(r.data?.STRIPE_SECRET_KEY, undefined)
  })

  it('accepts an EMPTY STRING and reads it as absent — the whole point', () => {
    const r = schema.safeParse({ STRIPE_SECRET_KEY: '' })
    assert.equal(r.success, true, 'an empty placeholder must not fail validation')
    assert.equal(r.data?.STRIPE_SECRET_KEY, undefined)
  })

  it('passes a real value through', () => {
    const r = schema.safeParse({ STRIPE_SECRET_KEY: 'sk_test_abc' })
    assert.equal(r.success, true)
    assert.equal(r.data?.STRIPE_SECRET_KEY, 'sk_test_abc')
  })

  it('demonstrates the naive spelling that caused the bug', () => {
    const naive = z.object({ K: z.string().min(1).optional() })
    // Absent is fine…
    assert.equal(naive.safeParse({}).success, true)
    // …but a blank placeholder throws, which is what took the build down.
    assert.equal(
      naive.safeParse({ K: '' }).success,
      false,
      'if this ever passes, the naive form is safe and optionalKey could be simplified',
    )
  })
})

describe('required keys still fail loudly', () => {
  const schema = z.object({ DATABASE_URL: z.string().url() })

  it('rejects a missing required var', () => {
    assert.equal(schema.safeParse({}).success, false)
  })

  it('rejects an empty required var rather than silently defaulting', () => {
    assert.equal(schema.safeParse({ DATABASE_URL: '' }).success, false)
  })
})
