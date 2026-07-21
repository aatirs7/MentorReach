import { BrowseFilters } from './filters'
import { MentorCard } from '@/components/mentor-card'
import { Card } from '@/components/ui/card'
import { browseMentors, listIndustries } from '@/lib/browse'
import { SESSION_LENGTHS } from '@/lib/mentor-schema'
import { parsePriceToCents } from '@/lib/mentor-schema'

export const metadata = {
  title: 'Browse mentors',
  description:
    'Book time with people who already have the job you want. Every mentor is hand-picked and personally reviewed before they join.',
  /**
   * Canonical is the BARE path, on purpose. The filters below are query params, so
   * /mentors?industry=Technology&length=30&max=8000 and every other combination is a
   * distinct URL serving a subset of the same cards. Left alone that's dozens of
   * near-duplicate pages splitting the ranking signal of the one page that matters.
   *
   * Pointing them all here consolidates that signal. It also means the filtered views
   * aren't independently indexable — the right trade until there are real per-industry
   * landing pages with their own copy, which is a content job, not a metadata one.
   */
  alternates: { canonical: '/mentors' },
  openGraph: {
    title: 'Browse mentors · MentorReach',
    description:
      'Book time with people who already have the job you want. Every mentor is hand-picked and personally reviewed before they join.',
    url: '/mentors',
  },
}

/**
 * Spec §8 — browse.
 *
 * PUBLIC, deliberately. This deviates from a literal reading of §2.3/§3, which would put
 * a sign-in wall in front of the mentor list — the exact page the homepage sends everyone
 * to, and the only content search engines could ever index. The survey's purpose is to
 * know who a student is before they TRANSACT, and that's preserved: booking still
 * requires sign-in plus a completed survey (see bookingGate()). Reading a public profile
 * costs nothing and reveals nothing.
 *
 * Recorded as an intentional deviation in docs/spec-coverage.md.
 */
export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; maxPrice?: string; length?: string }>
}) {
  const params = await searchParams

  const maxPriceCents = params.maxPrice ? parsePriceToCents(params.maxPrice) : null
  const lengthMinutes = params.length ? Number(params.length) : undefined

  const [mentors, industries] = await Promise.all([
    browseMentors({
      industry: params.industry || undefined,
      maxPriceCents: maxPriceCents ?? undefined,
      lengthMinutes: SESSION_LENGTHS.includes(lengthMinutes as 30 | 45 | 60)
        ? lengthMinutes
        : undefined,
    }),
    listIndustries(),
  ])

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-14">
      <div className="text-center">
        <p className="label-mono">Mentors</p>
        <h1 className="mt-3 text-4xl">Find someone who&rsquo;s done it</h1>
        <p className="mx-auto mt-3 max-w-prose text-slate">
          Every mentor here is hand-picked and personally reviewed before they join.
        </p>
      </div>

      <BrowseFilters industries={industries} />

      {mentors.length === 0 ? (
        <Card className="mt-10 border-line/20 p-10 text-center">
          <p className="text-lg">No mentors match those filters yet.</p>
          <p className="mt-2 text-sm text-slate">
            Try widening your search, or check back shortly. We&rsquo;re onboarding mentors now.
          </p>
        </Card>
      ) : (
        <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((c) => (
            <MentorCard key={c.userId} mentor={c} />
          ))}
        </div>
      )}
    </main>
  )
}
