import Image from 'next/image'
import Link from 'next/link'
import type { CoachCardData } from '@/components/coach-card'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/coach-schema'
import { initialOf, resolveHeadshot } from '@/lib/headshot'

/**
 * The browse result row: photo left, detail centre, price + action right.
 *
 * A ROW, not a grid card, and that's the point. A marketplace list is a comparison
 * surface — you're scanning price against experience against specialty, and rows put
 * those in aligned columns so the eye can run straight down each one. A 3-up grid of
 * small cards makes you re-find every value in a new place per tile.
 *
 * Deliberately NOT copied from Preply: rating, review count, "students taught", "lessons
 * given". We have none of those and inventing them would be fabricated social proof. The
 * space goes to what's actually true and actually useful here: what the coach does, where,
 * and what they help with.
 */
export function CoachRow({ coach }: { coach: CoachCardData }) {
  const source = resolveHeadshot(coach)

  return (
    <article className="group relative rounded-xl border border-line/15 bg-raised p-5 transition-colors hover:border-gold sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row">
        {/* Photo. Bigger than an avatar on purpose: the pitch is a real person. */}
        <div className="shrink-0">
          {source.kind === 'image' ? (
            <Image
              src={source.url}
              alt=""
              width={400}
              height={400}
              aria-hidden
              className="size-28 rounded-lg border border-line/15 object-cover sm:size-32"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-28 items-center justify-center rounded-lg bg-ink font-display text-4xl text-paper sm:size-32"
            >
              {initialOf(coach.fullName)}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl leading-snug">
            {/*
             * Whole-row link via ::after, so the entire card is one big target without
             * nesting the price/CTA inside an <a> (which would be invalid and would trap
             * the button).
             */}
            <Link
              href={`/coaches/${coach.userId}`}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {coach.fullName ?? 'Coach'}
            </Link>
          </h2>

          <p className="mt-1 text-sm text-slate">{coach.currentTitle}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-ink px-2.5 py-1 font-mono text-[10px] tracking-wider text-paper uppercase">
              {coach.industry}
            </span>
            {coach.specialties.slice(0, 3).map((s) => (
              <span
                key={s}
                className="rounded-full border border-gold/45 px-2.5 py-1 font-mono text-[10px] tracking-wider text-slate uppercase"
              >
                {s}
              </span>
            ))}
          </div>

          <p className="mt-3 line-clamp-2 max-w-prose text-sm leading-relaxed text-slate">
            {coach.bio}
          </p>
        </div>

        {/* Price + action. Fixed column so values line up down the list. */}
        <div className="flex shrink-0 flex-row items-end justify-between gap-4 border-line/12 sm:w-44 sm:flex-col sm:items-stretch sm:border-l sm:pl-6">
          <div className="sm:text-right">
            <p className="font-display text-2xl leading-none">
              {formatPrice(coach.startingPriceCents)}
            </p>
            <p className="mt-1.5 font-mono text-[10px] tracking-wider text-slate uppercase">
              from · {coach.lengths.join(' / ')} min
            </p>
          </div>

          {/* relative z-10 so it sits above the row-wide ::after link overlay. */}
          <Button asChild size="sm" className="relative z-10 sm:mt-auto sm:w-full">
            <Link href={`/coaches/${coach.userId}`}>View profile</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}

/**
 * Compact card for the landing mosaic: photo-forward, minimal text.
 *
 * This is the "faces first" move from Preply's hero — the fastest way to say "these are
 * real people" is to show them before you say anything.
 */
export function CoachTile({ coach }: { coach: CoachCardData }) {
  return (
    <Link
      href={`/coaches/${coach.userId}`}
      className="group block overflow-hidden rounded-xl border border-line/15 bg-raised transition-all hover:-translate-y-0.5 hover:border-gold"
    >
      <div className="relative">
        <CoachTilePhoto coach={coach} />
        <span className="absolute top-2.5 left-2.5 rounded-full bg-paper/95 px-2 py-1 font-mono text-[9px] tracking-wider text-ink uppercase">
          {coach.industry}
        </span>
      </div>
      <div className="p-3.5">
        <p className="truncate font-display text-base leading-snug">
          {coach.fullName ?? 'Coach'}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate">{coach.currentTitle}</p>
        <p className="mt-2 font-mono text-[10px] tracking-wider text-slate uppercase">
          from {formatPrice(coach.startingPriceCents)}
        </p>
      </div>
    </Link>
  )
}

function CoachTilePhoto({ coach }: { coach: CoachCardData }) {
  const source = resolveHeadshot(coach)

  if (source.kind === 'image') {
    return (
      <Image
        src={source.url}
        alt=""
        width={400}
        height={400}
        aria-hidden
        className="aspect-square w-full object-cover"
      />
    )
  }

  return (
    <div
      aria-hidden
      className="flex aspect-square w-full items-center justify-center bg-ink font-display text-5xl text-paper"
    >
      {initialOf(coach.fullName)}
    </div>
  )
}
