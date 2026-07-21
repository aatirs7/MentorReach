'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { MentorIcon, StudentIcon } from './role-icons'
import { Button } from '@/components/ui/button'
import { setRole } from '@/lib/auth/set-role'
import type { Role } from '@/types/globals'

/**
 * The two options are deliberately NOT visual equals: roughly 95% of signups are
 * students, so the student card is the ink block and the mentor card is the quiet
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
    cta: 'Find a mentor',
  },
  {
    role: 'mentor',
    title: 'I want to mentor',
    blurb:
      'Share what you know, set your own rates and hours, and get paid per session. We’ll walk you through setup and your profile goes live automatically once it’s complete.',
    cta: 'Start mentoring',
  },
] as const satisfies ReadonlyArray<{
  role: Extract<Role, 'student' | 'mentor'>
  title: string
  blurb: string
  cta: string
}>

export function RolePicker() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState<Role | null>(null)
  const [accepted, setAccepted] = useState(false)

  function choose(role: Extract<Role, 'student' | 'mentor'>) {
    if (!accepted) {
      setError('Please agree to the Terms of Service and Privacy Policy first.')
      return
    }
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
      window.location.href = role === 'student' ? '/onboarding/survey' : '/mentor/onboarding'
    })
  }

  return (
    <div className="mt-9">
      {/*
       * Above the cards on purpose: this is a precondition, not an afterthought. Both
       * links open in a new tab so reading them never discards the choice in progress.
       * setRole() writes the acceptance rows server-side — this checkbox gates the click,
       * it does not create the record.
       */}
      <label className="mx-auto mb-6 flex max-w-xl cursor-pointer items-start gap-3 rounded-xl border border-line/20 bg-raised p-4">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => {
            setAccepted(e.target.checked)
            if (e.target.checked) setError(null)
          }}
          className="mt-0.5 size-4 shrink-0 accent-gold"
        />
        <span className="text-sm leading-relaxed text-slate">
          I agree to the{' '}
          <a
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-gold underline-offset-4"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline decoration-gold underline-offset-4"
          >
            Privacy Policy
          </a>
          .
        </span>
      </label>

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
                <MentorIcon className="size-12 text-gold" />
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
                  disabled={pending || !accepted}
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
