import { sql } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { usersMissingConsent } from '@/lib/legal-acceptance'

export const dynamic = 'force-dynamic'

/**
 * Phase 0 verification endpoint: proves the app can actually reach Neon.
 *
 * GATED ON PURPOSE. An unauthenticated endpoint that confirms database reachability
 * and leaks a user count is a free recon gift. In production it 404s unless the caller
 * presents HEALTH_CHECK_TOKEN via the x-health-token header.
 */
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    const expected = process.env.HEALTH_CHECK_TOKEN
    const provided = req.headers.get('x-health-token')

    if (!expected || provided !== expected) {
      return new Response('Not found', { status: 404 })
    }
  }

  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(users)

    /**
     * Consent gaps are reported here so they can be noticed WITHOUT anyone opening the
     * admin console. Recording terms/privacy acceptance is non-fatal in setRole(), which
     * means a failed write is otherwise invisible: nothing in the product looks wrong.
     *
     * `ok` deliberately stays true — a gap is a data problem to remediate, not an outage,
     * and flipping health to failing would page someone about something no restart fixes.
     * The count is what a monitor should alert on.
     */
    const gaps = await usersMissingConsent()

    return Response.json({
      ok: true,
      now: new Date().toISOString(),
      userCount: row?.count ?? 0,
      consentGaps: gaps.length,
      ...(gaps.length
        ? { consentGapUserIds: gaps.slice(0, 20).map((g) => g.userId) }
        : {}),
    })
  } catch (err) {
    console.error('[health] database query failed', err)
    return Response.json({ ok: false, error: 'database unreachable' }, { status: 503 })
  }
}
