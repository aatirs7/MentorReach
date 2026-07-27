import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { LEGAL_KEYS, allDocuments, getDocument, keyForSlug } from './legal'

/**
 * The content-hash lock.
 *
 * Every hash below is the SHA-256 of a document's body at the version recorded beside it.
 * Editing a legal document without bumping its version breaks this test — which is the
 * entire point. Acceptance rows store a version AND a hash, so silently changing the text
 * under a fixed version would leave every prior signature pointing at words nobody agreed
 * to, with nothing in the system able to tell.
 *
 * WHEN THIS TEST FAILS, THE FIX IS NOT TO PASTE IN THE NEW HASH.
 * The procedure is:
 *   1. Copy the current file to src/content/legal/archive/<key>/<old-version>.md
 *   2. Bump `version` in the document's frontmatter
 *   3. Update BOTH the version and the hash in the table below
 * Anyone who signed the previous version is expected to re-sign — see docs/HANDOFF.md.
 */
const LOCKED: Record<string, { version: string; hash: string }> = {
  // 1.1.0 filled the LLC placeholders (entity name, Virginia, registered address,
  // Loudoun County, support email) from the official formation documents. The 1.0.0
  // placeholder drafts are preserved under src/content/legal/archive/<key>/1.0.0.md.
  // The dispute-resolution clause ([CHOOSE ONE, WITH COUNSEL:]) is still open by design.
  terms: {
    version: '1.1.0',
    hash: '77eb66e6578ff1a730fa7096007cfc1201e91c0317057c9e4bf6613391866b6f',
  },
  privacy: {
    version: '1.1.0',
    hash: '4da951c4870c239cd306b83001b6342c1799efe7a67c4287ebf208802c01c79b',
  },
  refunds: {
    version: '1.1.0',
    hash: '40fe8fb51c6cc4f3fc4cb53645d438fbbd874cd2c30cfca0daa3dddef5af7363',
  },
  mentor_agreement: {
    version: '1.1.0',
    hash: '2d1d4b3b56fdec8e3e83e7e6f435a294c6e8586805fe241532d32631f734ff5e',
  },
  // Unchanged — the handbook had no placeholders to fill.
  mentor_handbook: {
    version: '1.0.0',
    hash: '0b433b7ea0db0fcc16dd3755a3bf5333f76ea40606d0ce978d1ffc8e0b867d89',
  },
}

describe('legal documents', () => {
  test('every registered key resolves to a parseable document', () => {
    for (const key of LEGAL_KEYS) {
      const doc = getDocument(key)
      assert.ok(doc.title.length > 0, `${key} has no title`)
      assert.match(doc.version, /^\d+\.\d+\.\d+$/, `${key} version is not semver`)
      assert.match(doc.effectiveDate, /^\d{4}-\d{2}-\d{2}$/, `${key} effective_date is not ISO`)
      assert.ok(doc.content.length > 500, `${key} body looks truncated`)
    }
  })

  test('content has not changed without a version bump', () => {
    for (const doc of allDocuments()) {
      const locked = LOCKED[doc.key]
      assert.ok(locked, `${doc.key} is missing from the lock table`)

      if (locked.hash === '__FILL__') continue

      if (doc.version === locked.version) {
        assert.equal(
          doc.contentHash,
          locked.hash,
          `${doc.key} changed but its version is still ${doc.version}. ` +
            `Archive the old copy, bump the version, then update the lock table.`,
        )
      }
    }
  })

  test('slugs round-trip, and are URL-safe', () => {
    for (const doc of allDocuments()) {
      assert.equal(keyForSlug(doc.slug), doc.key)
      assert.match(doc.slug, /^[a-z0-9-]+$/)
    }
    assert.equal(keyForSlug('not-a-document'), null)
  })

  test('cross-document references are real links, never bare brackets', () => {
    for (const doc of allDocuments()) {
      // A reference like "[Mentor Agreement]" with no target is a dead end for the
      // reader and a sign the import missed one.
      const named = doc.placeholders.filter((p) =>
        /Agreement|Handbook|Terms of Service|Privacy Policy|Refund/i.test(p),
      )
      assert.deepEqual(named, [], `${doc.key} has unlinked document references: ${named.join(', ')}`)
    }
  })

  // The regex below is written as [Cc]oach deliberately: the character class breaks the
  // literal string, so a global find-and-replace of the old term cannot silently rewrite
  // the very assertion that guards against it.
  test('the rename left no trace of the old term behind', () => {
    for (const doc of allDocuments()) {
      const hits = doc.content.match(/\b[Cc]oach\w*/g) ?? []
      assert.deepEqual(hits, [], `${doc.key} still says: ${[...new Set(hits)].join(', ')}`)
    }
  })
})
