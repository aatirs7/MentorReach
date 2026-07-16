'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ANY = '__any'

/**
 * The hero's single action: pick a field, go.
 *
 * The marketplace pattern (Preply, Airbnb): the first click is already a filtered search
 * rather than a cold list. It costs nothing to skip — "Any field" just lands on /coaches
 * — but for someone who knows what they want it removes a whole step.
 *
 * A plain link, not a form POST: this is navigation to a filtered URL, which keeps the
 * result shareable and back-button-able.
 */
export function HeroSearch({
  industries,
  signedIn,
  ctaHref,
}: {
  industries: string[]
  signedIn: boolean
  ctaHref: string
}) {
  const router = useRouter()
  const [industry, setIndustry] = useState<string>(ANY)

  if (signedIn) {
    return (
      <Button asChild size="lg">
        <Link href={ctaHref}>Go to your dashboard</Link>
      </Button>
    )
  }

  function go() {
    router.push(industry === ANY ? '/coaches' : `/coaches?industry=${encodeURIComponent(industry)}`)
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line/25 bg-raised p-2 sm:flex sm:items-stretch sm:gap-2">
        <div className="flex-1 px-3 py-2 text-left">
          <p className="font-mono text-[10px] tracking-widest text-slate uppercase">
            What field?
          </p>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger
              aria-label="What field are you interested in?"
              className="mt-0.5 h-auto w-full border-0 p-0 font-display text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any field</SelectItem>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="lg" onClick={go} className="mt-2 w-full sm:mt-0 sm:w-auto sm:self-stretch">
          Find a coach
        </Button>
      </div>

      <p className="text-sm text-slate">
        Browsing is free.{' '}
        <Link
          href="/sign-up"
          className="underline decoration-gold underline-offset-4 hover:text-ink"
        >
          Or coach on Trajectory
        </Link>
      </p>
    </div>
  )
}
