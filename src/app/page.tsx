import Link from 'next/link'
import { CoachAvatar, CoachCard } from '@/components/coach-card'
import { Button } from '@/components/ui/button'
import { getDbUser } from '@/lib/auth/ensure-user'
import { browseCoaches, listIndustries, rosterEmployers } from '@/lib/browse'
import { TRUST_BLOCK_BODY, TRUST_BLOCK_TITLE } from '@/lib/policy-copy'

/**
 * Spec §1 — the homepage. Warm, editorial, generous whitespace, no heavy shadows.
 *
 * SECTION RHYTHM. Tones alternate the whole way down so the page has a pulse as you
 * scroll, rather than reading as one flat template:
 *
 *   hero          INK         full-bleed, centered type + roster proof
 *   how it works  sand        recessed band, raised cards
 *   coaches       paper       + raised cards
 *   coach CTA     INK         full-bleed
 *   trust         sand-deep
 *   footer        ink
 *
 * No two adjacent sections share a tone. That's also why the coach CTA sits ABOVE the
 * trust band rather than last: the footer is ink, so a full-bleed ink CTA immediately
 * before it would merge into one undifferentiated dark mass. The trust band between them
 * both keeps the alternation honest and closes the page on a reassurance.
 *
 * Depth comes from those blocks, not shadows (§1).
 *
 * TWO THINGS NOT TO UNDO:
 *  - The hero is CENTERED TYPE, not text-left/card-right. That split, over a warm
 *    ground, under a serif headline carrying one accent-colored phrase, is the shared
 *    composition of this whole category — see the note at the top of globals.css.
 *  - The hero is INK. Putting it on the near-white ground was tried and looked like an
 *    unstyled draft: with the navy and gold below the fold there was no brand color
 *    above it at all.
 */
export default async function Home() {
  const user = await getDbUser()

  const [featured, industries, employers] = await Promise.all([
    browseCoaches().then((c) => c.slice(0, 6)),
    listIndustries(),
    rosterEmployers(),
  ])

  const ctaHref = user ? (user.role === 'coach' ? '/coach' : '/coaches') : '/coaches'

  return (
    <main className="editorial flex-1">
      {/* ---------------------------------------------------------------- HERO */}
      {/*
       * The hero IS the ink block. An earlier pass put the headline on the near-white
       * ground with the ink and gold pushed below the fold, and it read as an unstyled
       * draft: three neutrals, no brand color, nothing anchoring a very tall section.
       * Differentiating from the category by SUBTRACTION produced blandness. The brand
       * is a deep navy with a gold accent — so lead with it.
       */}
      <section className="relative overflow-hidden bg-ink text-paper">
        {/* Two offset washes, not one: a single centered glow reads as a gradient
            preset. Offsetting them gives the flat navy a direction of light. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 right-[-10%] size-[42rem] rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-20rem] left-[-10%] size-[38rem] rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--line), transparent 70%)' }}
        />

        <div className="relative mx-auto w-full max-w-4xl px-6 pt-24 pb-20 text-center">
          <p className="eyebrow text-gold">Career coaching, honestly</p>

          {/*
           * No accent-colored phrase inside the headline — that device is the category's
           * signature. The contrast does the work here instead.
           */}
          <h1 className="text-hero mx-auto mt-6 max-w-4xl text-balance text-paper">
            Reach the people who&rsquo;ve been there.
          </h1>

          <p className="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-paper/70">
            Book time with people who already have the job you want. No mentorship theater
            and no generic advice. Just a real conversation with someone who did the thing
            you&rsquo;re trying to do.
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-gold text-ink hover:bg-gold/90">
              <Link href={ctaHref}>{user ? 'Go to your dashboard' : 'Find a coach'}</Link>
            </Button>
            {!user ? (
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-paper/25 bg-transparent text-paper hover:bg-paper/10 hover:text-paper"
              >
                <Link href="/coaches/apply">Coach on MentorReach</Link>
              </Button>
            ) : null}
          </div>

          {/*
           * Proof, above the fold, from the live roster — real faces and real employers
           * rather than a claim. Both are roster-derived: if the roster empties, this
           * renders nothing instead of becoming a lie.
           */}
          {featured.length > 0 ? (
            <div className="mt-14 flex flex-col items-center gap-4 border-t border-paper/10 pt-8">
              <div className="flex -space-x-3">
                {featured.slice(0, 5).map((c) => (
                  <CoachAvatar
                    key={c.userId}
                    coach={c}
                    size={40}
                    className="ring-2 ring-ink"
                  />
                ))}
              </div>
              {employers.length > 0 ? (
                <p className="max-w-lg text-sm leading-relaxed text-paper/55">
                  Hand-picked coaches from{' '}
                  <span className="text-paper/80">{employers.slice(0, 5).join(', ')}</span>
                  {employers.length > 5 ? ', and more.' : '.'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      {/* -------------------------------------------------------- HOW IT WORKS */}
      {/*
       * Recessed sand band with LIFTED cards. The previous version was three bare
       * columns of text, which is where a lot of the "unfinished" read came from —
       * stacked surfaces give the section a floor and a ceiling without a shadow (§1).
       */}
      <section className="border-y border-line/10 bg-sand">
        <div className="mx-auto w-full max-w-5xl px-6 py-20">
          <p className="eyebrow text-center">How it works</p>
          <h2 className="text-section mt-3 text-center">Three steps, no theater</h2>

          <ol className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              { n: '01', t: 'Tell us where you’re headed', d: 'A short survey covering your year, your field, and what you need.' },
              { n: '02', t: 'Pick someone who’s been there', d: 'Pick someone who’s actually done the thing you’re aiming for.' },
              { n: '03', t: 'Book, pay, and talk', d: 'Pay securely, pick a time. Free cancellation up to 24 hours before.' },
            ].map((s) => (
              <li
                key={s.n}
                className="rounded-xl border border-line/15 bg-raised p-6 text-center"
              >
                <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-ink font-mono text-xs text-gold">
                  {s.n}
                </span>
                <h3 className="mt-4 text-lg leading-snug">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ----------------------------------------------------------- COACHES */}
      {featured.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-6 py-24 text-center">
          <p className="eyebrow">Our coaches</p>
          <h2 className="text-section mt-3">People who&rsquo;ve done it</h2>
          <p className="mx-auto mt-4 max-w-md text-slate">
            Hand-picked. We personally review every coach before they join.
          </p>

          {/*
           * Roster-derived, never hardcoded: a fixed list becomes a false claim the moment
           * a coach leaves. If the roster empties, this renders nothing. (The employer
           * list is the same idea, but it now sits in the hero as above-the-fold proof.)
           */}
          {industries.length > 0 ? (
            <div className="mt-9 border-y border-line/15 py-5">
              <p className="eyebrow">Coaching across</p>
              <div className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-2">
                {industries.slice(0, 7).map((i) => (
                  <span key={i} className="font-display text-base text-ink/70">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-10 grid gap-5 text-left sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <CoachCard key={c.userId} coach={c} />
            ))}
          </div>

          <Link
            href="/coaches"
            className="mt-10 inline-block text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            See all coaches
          </Link>
        </section>
      ) : null}

      {/* ------------------------------------------------- COACH CTA (anchor) */}
      <section className="relative overflow-hidden bg-ink">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />
        <div className="relative mx-auto w-full max-w-3xl px-6 py-28 text-center">
          <p className="eyebrow text-paper/50">For coaches</p>
          <h2 className="text-section mt-4 text-paper">Know something worth sharing?</h2>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-paper/70">
            Set your own rates and hours. Get paid per session. We review every coach before
            they go live.
          </p>
          <Button asChild size="lg" className="mt-8 bg-gold text-ink hover:bg-gold/90">
            <Link href="/coaches/apply">Become a coach</Link>
          </Button>
        </div>
      </section>

      {/* --------------------------------------------------------- TRUST BAND */}
      <section className="border-b border-line/15 bg-sand-deep">
        <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-20 text-center sm:grid-cols-3">
          {[
            { t: 'Hand-picked', d: 'We personally review every coach before they join.' },
            { t: 'Paid on-platform', d: 'Payment runs through Stripe. No off-platform arrangements, and no chasing anyone for an invoice.' },
            { t: TRUST_BLOCK_TITLE, d: TRUST_BLOCK_BODY },
          ].map((f) => (
            <div key={f.t}>
              <span aria-hidden className="mx-auto mb-4 block h-px w-10 bg-gold" />
              <h3 className="font-display text-lg leading-snug">{f.t}</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
