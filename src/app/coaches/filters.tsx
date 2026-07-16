'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SESSION_LENGTHS } from '@/lib/coach-schema'

/**
 * Spec §8 — browse filters: industry/field, price, session length.
 *
 * Filter state lives in the URL, not React state: it survives a refresh, is shareable,
 * and lets the server component filter against the database rather than shipping every
 * coach to the client.
 *
 * The layout follows the marketplace convention (Preply, Airbnb): one horizontal bar of
 * boxed controls, each with its label INSIDE the box. That's denser and more scannable
 * than labels floating above, and it reads as a control surface rather than a form.
 */
const ANY = '__any'

export function BrowseFilters({ industries }: { industries: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function apply(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString())

    if (!value || value === ANY) next.delete(key)
    else next.set(key, value)

    startTransition(() => {
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
    })
  }

  const hasFilters = ['industry', 'maxPrice', 'length', 'q'].some((k) => searchParams.get(k))

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FilterBox label="Field">
        <Select
          value={searchParams.get('industry') ?? ANY}
          onValueChange={(v) => apply('industry', v)}
        >
          <SelectTrigger
            aria-label="Field"
            className="h-auto border-0 p-0 font-display text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
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
      </FilterBox>

      <FilterBox label="Session length">
        <Select value={searchParams.get('length') ?? ANY} onValueChange={(v) => apply('length', v)}>
          <SelectTrigger
            aria-label="Session length"
            className="h-auto border-0 p-0 font-display text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any length</SelectItem>
            {SESSION_LENGTHS.map((l) => (
              <SelectItem key={l} value={String(l)}>
                {l} minutes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBox>

      <FilterBox label="Max price">
        <div className="flex items-center gap-1">
          <span className="font-display text-base text-slate">$</span>
          <Input
            aria-label="Maximum price in dollars"
            inputMode="decimal"
            defaultValue={searchParams.get('maxPrice') ?? ''}
            placeholder="Any"
            className="h-auto border-0 p-0 font-display text-base shadow-none placeholder:text-slate focus-visible:ring-0 dark:bg-transparent"
            // Commit on blur/Enter rather than per keystroke: a query per character
            // would hammer the database for no benefit.
            onBlur={(e) => apply('maxPrice', e.target.value.trim() || null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                apply('maxPrice', e.currentTarget.value.trim() || null)
              }
            }}
          />
        </div>
      </FilterBox>

      <FilterBox label="Search">
        <Input
          aria-label="Search by name, role or specialty"
          defaultValue={searchParams.get('q') ?? ''}
          placeholder="Name, role, specialty"
          className="h-auto border-0 p-0 font-display text-base shadow-none placeholder:text-slate focus-visible:ring-0 dark:bg-transparent"
          onBlur={(e) => apply('q', e.target.value.trim() || null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              apply('q', e.currentTarget.value.trim() || null)
            }
          }}
        />
      </FilterBox>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          disabled={pending}
          className="justify-self-start text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink lg:col-span-4"
        >
          Clear all filters
        </button>
      ) : null}
    </div>
  )
}

/** Label inside the box, value below it — the marketplace filter convention. */
function FilterBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line/25 bg-raised px-3.5 py-2.5 text-left focus-within:border-gold">
      <p className="font-mono text-[10px] tracking-widest text-slate uppercase">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}
