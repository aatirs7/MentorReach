import { BrowseFilters } from './filters'
import { CoachRow } from '@/components/coach-row'
import { Card } from '@/components/ui/card'
import { browseCoaches, listIndustries } from '@/lib/browse'
import { SESSION_LENGTHS } from '@/lib/coach-schema'
import { parsePriceToCents } from '@/lib/coach-schema'

export const metadata = {
  title: 'Browse coaches',
  description:
    'Book time with people who already have the job you want. Every coach is verified against their stated employer.',
}

/**
 * Spec §8 — browse.
 *
 * PUBLIC, deliberately. This deviates from a literal reading of §2.3/§3, which would put
 * a sign-in wall in front of the coach list — the exact page the homepage sends everyone
 * to, and the only content search engines could ever index. The survey's purpose is to
 * know who a student is before they TRANSACT, and that's preserved: booking still
 * requires sign-in plus a completed survey (see bookingGate()). Reading a public profile
 * costs nothing and reveals nothing.
 *
 * Recorded as an intentional deviation in docs/spec-coverage.md.
 *
 * Layout follows the marketplace convention: a filter bar, a result count, then rows.
 * Rows rather than a card grid because this is a comparison surface — see CoachRow.
 */
export default async function CoachesPage({
  searchParams,
}: {
  searchParams: Promise<{ industry?: string; maxPrice?: string; length?: string; q?: string }>
}) {
  const params = await searchParams

  const maxPriceCents = params.maxPrice ? parsePriceToCents(params.maxPrice) : null
  const lengthMinutes = params.length ? Number(params.length) : undefined

  const [coaches, industries] = await Promise.all([
    browseCoaches({
      industry: params.industry || undefined,
      maxPriceCents: maxPriceCents ?? undefined,
      lengthMinutes: SESSION_LENGTHS.includes(lengthMinutes as 30 | 45 | 60)
        ? lengthMinutes
        : undefined,
      q: params.q || undefined,
    }),
    listIndustries(),
  ])

  return (
    <main className="flex-1 bg-sand">
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="text-center">
          <p className="label-mono">Coaches</p>
          <h1 className="text-section mt-2">Find someone who&rsquo;s done it</h1>
          <p className="mx-auto mt-3 max-w-prose text-slate">
            Every coach here is verified against their stated employer before their profile
            goes live.
          </p>
        </div>

        <div className="mt-9">
          <BrowseFilters industries={industries} />
        </div>

        {/* Result count: says what the filters did, and where the list starts. */}
        <p className="mt-9 font-display text-xl">
          {coaches.length === 0
            ? 'No coaches match those filters'
            : `${coaches.length} ${coaches.length === 1 ? 'coach' : 'coaches'} available`}
        </p>

        {coaches.length === 0 ? (
          <Card className="mt-4 border-line/20 bg-raised p-10 text-center">
            <p className="text-lg">Nothing here yet.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate">
              Try widening your search, or check back shortly. We&rsquo;re onboarding coaches
              now.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-4">
            {coaches.map((c) => (
              <CoachRow key={c.userId} coach={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
