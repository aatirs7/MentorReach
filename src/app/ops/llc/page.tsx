import { LlcWizard } from './llc-wizard'
import { requireAdmin } from '@/lib/auth/guards'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'LLC setup', ...NO_INDEX }

/**
 * The Virginia LLC formation walkthrough, for the two founders.
 *
 * Founders-only — /ops/layout.tsx gates the whole tree. It lives under /ops rather than
 * /admin because /admin is oversight of the marketplace (mentors, students, reports) and
 * this is company-building work, which is what /ops already holds.
 *
 * No database, no server actions: it is a static walkthrough whose only state is which
 * step you are on, kept in the browser. requireAdmin() here is belt-and-braces alongside
 * the layout gate, since a page is cheap to protect twice and the content names bank and
 * tax specifics.
 */
export default async function LlcSetupPage() {
  await requireAdmin()
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-16">
      <LlcWizard />
    </main>
  )
}
