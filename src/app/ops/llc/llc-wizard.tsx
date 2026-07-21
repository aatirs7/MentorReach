'use client'

import { useEffect, useState } from 'react'
import { STEPS } from './steps'
import { Button } from '@/components/ui/button'

/**
 * The LLC formation walkthrough — one step at a time.
 *
 * A wizard rather than a long page because this is followed while filling in forms on
 * other sites, and the useful question at any moment is "what do I do next", not "where
 * am I in a document".
 *
 * Progress is kept in localStorage, so it is per-browser and does NOT sync between the
 * two founders. That is stated in the footer rather than left to be discovered: a
 * checkbox that silently reflected someone else's progress would be worse than one that
 * plainly doesn't.
 */
const STORAGE_KEY = 'mentorreach-llc-wizard'

const CHIP_TONE: Record<string, string> = {
  cost: 'text-[#8a6524]',
  free: 'text-[#3f6b4f]',
  time: 'text-slate',
  pro: 'text-destructive',
}

export function LlcWizard() {
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [showIndex, setShowIndex] = useState(false)
  /**
   * Nothing is read from localStorage until after mount. Reading it during the first
   * render would produce markup that disagrees with the server's and trip a hydration
   * mismatch, so the first paint is always step 1 and the saved position lands a tick later.
   */
  const [ready, setReady] = useState(false)

  useEffect(() => {
    /**
     * Restoring AFTER mount rather than in a useState initializer is deliberate, and the
     * lint suppressions below are the cost of it: reading localStorage during the first
     * (server-matched) render would produce markup the server never emitted and trip a
     * hydration mismatch. Same pattern, same reason, as the mentor application form.
     */
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { i?: number; done?: Record<string, boolean> }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (typeof saved.i === 'number') setIndex(Math.min(Math.max(saved.i, 0), STEPS.length - 1))
         
        if (saved.done) setDone(saved.done)
      }
    } catch {
      /* corrupt or unavailable storage just means starting from the top */
    }
     
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ i: index, done }))
    } catch {
      /* ignore */
    }
  }, [index, done, ready])

  const step = STEPS[index]!
  const doneCount = Object.values(done).filter(Boolean).length
  const pct = Math.round(((index + 1) / STEPS.length) * 100)

  function go(next: number) {
    setIndex(Math.min(Math.max(next, 0), STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Arrow keys move between steps, but never while someone is typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      if (e.key === 'ArrowRight') go(index + 1)
      if (e.key === 'ArrowLeft') go(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div>
      {/* Progress */}
      <div className="sticky top-0 z-10 -mx-6 border-b border-line/15 bg-paper/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4">
          <span className="label-mono">MentorReach · LLC</span>
          <span className="ml-auto font-mono text-[11px] text-slate tabular-nums">
            Step {index + 1} of {STEPS.length} · {doneCount} done
          </span>
        </div>
        <div className="mx-auto mt-2 h-0.5 w-full max-w-2xl overflow-hidden rounded-full bg-sand-deep">
          <div className="h-full bg-gold transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <p className="label-mono mt-12 text-center">{step.phase}</p>
        <h1 className="mt-3 text-center text-3xl leading-tight sm:text-4xl">{step.title}</h1>

        <div className="mt-8">{step.body}</div>

        {step.note ? (
          <div
            className={`mx-auto mt-6 max-w-prose rounded-r-xl border-l-2 py-4 pr-5 pl-5 ${
              step.note.tone === 'pro'
                ? 'border-destructive bg-destructive/5'
                : step.note.tone === 'watch'
                  ? 'border-[#8a6524] bg-sand'
                  : 'border-gold bg-sand'
            }`}
          >
            <p
              className={`font-display text-base leading-snug ${
                step.note.tone === 'pro' ? 'text-destructive' : 'text-ink'
              }`}
            >
              {step.note.heading}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate">{step.note.body}</p>
          </div>
        ) : null}

        {step.afterNote ? <div className="mt-2">{step.afterNote}</div> : null}

        {step.links?.length ? (
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {step.links.map((l) => (
              <Button asChild key={l.href} size="sm">
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label} →
                </a>
              </Button>
            ))}
          </div>
        ) : null}

        {step.chips?.length ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {step.chips.map((c) => (
              <span
                key={c.text}
                className={`rounded border border-current px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase ${CHIP_TONE[c.tone]}`}
              >
                {c.text}
              </span>
            ))}
          </div>
        ) : null}

        <label className="mt-9 flex cursor-pointer items-center justify-center gap-2.5 text-sm text-slate">
          <input
            type="checkbox"
            checked={Boolean(done[step.id])}
            onChange={(e) => setDone((d) => ({ ...d, [step.id]: e.target.checked }))}
            className="size-4 accent-gold"
          />
          {done[step.id] ? 'Done' : 'Mark this done'}
        </label>

        <div className="mt-8 flex items-center justify-center gap-3 border-t border-line/15 pt-6">
          <Button variant="outline" onClick={() => go(index - 1)} disabled={index === 0}>
            ← Back
          </Button>
          <Button onClick={() => go(index + 1)} disabled={index === STEPS.length - 1}>
            {index === STEPS.length - 1 ? 'Finished' : 'Next →'}
          </Button>
        </div>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => setShowIndex((s) => !s)}
            className="label-mono hover:text-ink"
          >
            {showIndex ? 'Hide all steps' : 'All steps'}
          </button>
        </div>

        {showIndex ? (
          <ul className="mt-4 border-t border-line/15">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    go(i)
                    setShowIndex(false)
                  }}
                  className={`flex w-full items-baseline gap-3 border-b border-line/12 px-1 py-2.5 text-left text-sm transition-colors hover:text-ink ${
                    i === index ? 'font-medium text-ink' : 'text-slate'
                  }`}
                >
                  <span className="w-4 shrink-0 text-gold">{done[s.id] ? '✓' : ''}</span>
                  <span className="min-w-0 flex-1">{s.title}</span>
                  <span className="shrink-0 font-mono text-[10px] tracking-wide text-slate uppercase">
                    {s.phase.split('·').pop()!.trim()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-12 border-t border-line/15 pt-6 text-center text-xs leading-relaxed text-slate">
          A practical guide, not legal or tax advice. Everything here is standard, documented process
          except the steps flagged <span className="text-destructive">needs a pro</span>. Researched
          July 2026 — verify anything with a deadline or a dollar figure. Progress saves in this
          browser only; it does not sync between the two of you.
        </p>
      </div>
    </div>
  )
}
