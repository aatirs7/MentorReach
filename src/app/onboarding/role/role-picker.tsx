'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CoachIcon, StudentIcon } from './role-icons'
import { Button } from '@/components/ui/button'
import { setRole } from '@/lib/auth/set-role'
import type { Role } from '@/types/globals'

/**
 * The two options are deliberately NOT visual equals: roughly 95% of signups are
 * students, so the student card is the ink block and the coach card is the quiet
 * outlined one beside it. Two identical outlined cards made the reader do work the
 * data already answers.
 *
 * Student is first in this array, which is also the mobile stacking order — the
 * primary choice must not sit below the fold on a phone.
 */
const CHOICES = [
  {
    role: 'student',
    title: "I'm a student",
    blurb:
      'Find someone who already has the job you want, and book time with them. We’ll ask a few questions first so we can point you at the right people.',
    cta: 'Find a coach',
  },
  {
    role: 'coach',
    title: 'I want to coach',
    blurb:
      'Share what you know, set your own rates and hours, and get paid per session. We’ll walk you through setup and your profile goes live automatically once it’s complete.',
    cta: 'Start coaching',
  },
] as const satisfies ReadonlyArray<{
  role: Extract<Role, 'student' | 'coach'>
  title: string
  blurb: string
  cta: string
}>

export function RolePicker() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Role | null>(null)

  function choose(role: Extract<Role, 'student' | 'coach'>) {
    setError(null)
    setChosen(role)

    startTransition(async () => {
      const result = await setRole(role)

      if (!result.ok) {
        setError(result.error)
        setChosen(null)
        return
      }

      // Clerk's session token only picks up the new claim on refresh, so a client-side
      // push would still read the old (empty) role and bounce us back here.
      window.location.href = role === 'student' ? '/onboarding/survey' : '/coach/onboarding'
    })
  }

  return (
    <div className="mt-9">
      {/*
       * Uneven columns on desktop so the primary card is physically larger, not just
       * darker. items-stretch keeps both CTAs on the same baseline despite the blurbs
       * differing in length.
       */}
      <div className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-[1.08fr_0.92fr]">
        {CHOICES.map((c) => {
          const primary = c.role === 'student'
          const busy = pending && chosen === c.role

          return (
            <div
              key={c.role}
              className={
                primary
                  ? 'flex flex-col rounded-2xl bg-ink p-8 text-paper transition-transform duration-200 hover:-translate-y-0.5'
                  : 'flex flex-col rounded-2xl border border-line/25 bg-paper p-7 transition-colors duration-200 hover:border-gold'
              }
            >
              {primary ? (
                <StudentIcon className="size-12 text-gold" />
              ) : (
                <CoachIcon className="size-12 text-gold" />
              )}

              <h2 className={primary ? 'mt-5 text-2xl' : 'mt-5 text-xl'}>{c.title}</h2>

              <p
                className={`mt-2.5 text-sm leading-relaxed ${
                  primary ? 'text-paper/70' : 'text-slate'
                }`}
              >
                {c.blurb}
              </p>

              {/* mt-auto pins the CTAs to a shared baseline whatever the blurb height. */}
              <div className="mt-auto pt-7">
                <Button
                  type="button"
                  size="lg"
                  variant={primary ? 'default' : 'outline'}
                  disabled={pending}
                  onClick={() => choose(c.role)}
                  className={
                    primary
                      ? 'w-full bg-gold text-ink hover:bg-gold/90'
                      : 'w-full border-line/40 bg-transparent text-ink hover:bg-secondary'
                  }
                >
                  {busy ? 'Setting up…' : c.cta}
                  {busy ? null : (
                    <span aria-hidden className="ml-1.5">
                      →
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}{' '}
          <button type="button" className="underline" onClick={() => router.refresh()}>
            Refresh
          </button>
        </p>
      ) : null}
    </div>
  )
}
