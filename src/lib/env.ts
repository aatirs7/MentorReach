import 'server-only'
import { z } from 'zod'

/**
 * Server-side env validation. Fails fast at boot rather than at the first query.
 *
 * Hand-rolled rather than @t3-oss/env-nextjs: it's ten lines, and that package's whole
 * job is a client/server split we don't have yet. NEXT_PUBLIC_* vars must be referenced
 * as full literals (`process.env.NEXT_PUBLIC_X`) in client code for Next's inliner to
 * see them, so they don't belong in this module anyway.
 */
const schema = z.object({
  /** Neon POOLED connection string (…-pooler.…). Migrations use the unpooled one. */
  DATABASE_URL: z.string().url(),

  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  /** Optional: gates /api/health in production. */
  HEALTH_CHECK_TOKEN: z.string().min(1).optional(),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`Invalid or missing environment variables:\n${missing}\n\nSee .env.example.`)
}

export const env = parsed.data
