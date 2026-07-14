/**
 * drizzle-kit runs OUTSIDE the Next.js runtime, so it does not get Next's automatic
 * .env.local loading. Two details here each cost an hour if missed:
 *
 * 1. `config({ path: '.env.local' })`, NOT `import 'dotenv/config'`. Every tutorial
 *    writes the latter, which loads `.env` — but Next writes secrets to `.env.local`.
 *    Get this wrong and drizzle-kit reports "DATABASE_URL is undefined" while the dev
 *    server works fine.
 *
 * 2. Point at the UNPOOLED url. DDL through PgBouncer in transaction mode is a known
 *    source of weird failures. The app uses pooled; migrations use direct.
 */
import { config } from 'dotenv'

config({ path: '.env.local' })

import { defineConfig } from 'drizzle-kit'

const url = process.env.DATABASE_URL_UNPOOLED

if (!url) {
  throw new Error(
    'DATABASE_URL_UNPOOLED is not set. drizzle-kit needs the DIRECT (non-pooler) Neon\n' +
      'connection string — the one WITHOUT "-pooler" in the host. See .env.example.',
  )
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  verbose: true,
  strict: true,
})
