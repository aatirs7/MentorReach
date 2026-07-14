import 'server-only'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { env } from '@/lib/env'
import * as schema from './schema'

/**
 * Driver choice: neon-http (not node-postgres, not neon-serverless).
 *
 * Vercel functions don't reuse connections across invocations, so a pg.Pool leaks
 * connections until Neon's limit is hit. HTTP has the lowest cold-start cost for the
 * one-or-two-queries-per-request shape of Phase 0 and most of Phase 1.
 *
 * THE CATCH: neon-http does NOT support interactive transactions
 * (`db.transaction(async tx => …)`). It does support `db.batch()` — multiple
 * statements in one atomic round-trip. Phase 1's booking flow (insert
 * coach_student_links + insert sessions atomically) is expressible as a batch().
 *
 * If a future route genuinely needs an interactive transaction, add a SECOND export
 * here backed by `drizzle-orm/neon-serverless` (WebSocket Pool) and use it only for
 * that route. One-file change, paid for at the right time — don't preemptively adopt
 * WebSockets to buy a transaction we may never need.
 */
const sql = neon(env.DATABASE_URL)

export const db = drizzle({ client: sql, schema })

export { schema }
