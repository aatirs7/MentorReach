import 'server-only'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { headers } from 'next/headers'
import { db } from '@/db'
import { legalAcceptances } from '@/db/schema'
import { type LegalKey, getDocument } from './legal'

// Signature validation is shared with the client form — see legal-acceptance-shared.ts.
export { signatureLooksDifferent, validateSignature } from './legal-acceptance-shared'

export type AcceptanceMethod = 'checkbox' | 'typed_signature'

/**
 * Capture the circumstances of an acceptance.
 *
 * An electronic signature's weight in a dispute comes from the record around it — when,
 * from where, in what client — not from the typed name itself. Both values are
 * best-effort: a proxy can omit or forge them, so they are evidence, not proof, and the
 * column is nullable rather than pretending otherwise.
 *
 * x-forwarded-for is a comma-separated chain; the FIRST entry is the client as seen by
 * the outermost proxy, which is the only one that means anything here.
 */
async function requestContext(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  return { ipAddress: ip, userAgent: h.get('user-agent') }
}

/**
 * Record acceptance of one or more documents.
 *
 * ALWAYS INSERTS. Re-accepting after a version bump is a new row, never an update — the
 * table is the evidence trail, and one you can overwrite is not one. The version and hash
 * are read from the document registry at write time rather than passed in by the caller,
 * so a client cannot claim to have accepted a version it never saw.
 */
export async function recordAcceptance(params: {
  userId: string
  keys: readonly LegalKey[]
  method: AcceptanceMethod
  signatureName?: string | null
}): Promise<void> {
  const { ipAddress, userAgent } = await requestContext()

  const rows = params.keys.map((key) => {
    const doc = getDocument(key)
    return {
      userId: params.userId,
      documentKey: key,
      documentVersion: doc.version,
      contentHash: doc.contentHash,
      signatureName: params.signatureName?.trim() || null,
      method: params.method,
      ipAddress,
      userAgent,
    }
  })

  await db.insert(legalAcceptances).values(rows)
}

export type AcceptanceRecord = typeof legalAcceptances.$inferSelect

/** The most recent acceptance per document for one user. */
export async function acceptancesFor(
  userId: string,
  keys?: readonly LegalKey[],
): Promise<Map<LegalKey, AcceptanceRecord>> {
  const rows = await db
    .select()
    .from(legalAcceptances)
    .where(
      keys?.length
        ? and(
            eq(legalAcceptances.userId, userId),
            inArray(legalAcceptances.documentKey, keys as string[]),
          )
        : eq(legalAcceptances.userId, userId),
    )
    .orderBy(desc(legalAcceptances.acceptedAt))

  // Newest first, so the first row seen for a key is the one that counts.
  const latest = new Map<LegalKey, AcceptanceRecord>()
  for (const r of rows) {
    const key = r.documentKey as LegalKey
    if (!latest.has(key)) latest.set(key, r)
  }
  return latest
}

/**
 * Has this user accepted the CURRENT version of a document?
 *
 * Compares version, not merely existence. A signature against an older version is a real
 * record of a real agreement — it just isn't agreement to what the document says today,
 * which is the question the publishing gate asks.
 */
export async function hasCurrentAcceptance(userId: string, key: LegalKey): Promise<boolean> {
  const doc = getDocument(key)
  const rows = await db
    .select({ id: legalAcceptances.id })
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.userId, userId),
        eq(legalAcceptances.documentKey, key),
        eq(legalAcceptances.documentVersion, doc.version),
      ),
    )
    .limit(1)

  return rows.length > 0
}

/**
 * Which of these users have signed the CURRENT Mentor Agreement.
 *
 * Bulk, because the admin roster and the mentor dashboard both need this for a list of
 * people at once, and asking per row is how a page acquires an N+1.
 */
export async function signedCurrentAgreement(userIds: string[]): Promise<Set<string>> {
  if (!userIds.length) return new Set()

  const doc = getDocument('mentor_agreement')
  const rows = await db
    .selectDistinct({ userId: legalAcceptances.userId })
    .from(legalAcceptances)
    .where(
      and(
        inArray(legalAcceptances.userId, userIds),
        eq(legalAcceptances.documentKey, 'mentor_agreement'),
        eq(legalAcceptances.documentVersion, doc.version),
      ),
    )

  return new Set(rows.map((r) => r.userId))
}
