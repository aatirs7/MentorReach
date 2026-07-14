import { sql } from 'drizzle-orm'
import type { NextRequest } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'

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

    return Response.json({
      ok: true,
      now: new Date().toISOString(),
      userCount: row?.count ?? 0,
    })
  } catch (err) {
    console.error('[health] database query failed', err)
    return Response.json({ ok: false, error: 'database unreachable' }, { status: 503 })
  }
}
