'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import {
  finishOnboarding,
  type OnboardingState,
  saveAboutStep,
  saveHandbookStep,
  saveSessionsStep,
} from './actions'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { INDUSTRIES, SESSION_LENGTHS } from '@/lib/mentor-schema'

function Field({
  label,
  hint,
  htmlFor,
  errors,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  errors?: string[]
  children: React.ReactNode
}) {
  return (
    <div className="text-center">
      <Label htmlFor={htmlFor} className="text-base font-normal text-ink">
        {label}
      </Label>
      {hint ? <p className="mx-auto mt-1 max-w-md text-sm text-slate">{hint}</p> : null}
      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-md text-left">{children}</div>
      </div>
      {errors?.length ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {errors[0]}
        </p>
      ) : null}
    </div>
  )
}

function SubmitRow({ pending, label }: { pending: boolean; label: string }) {
  return (
    <div className="pt-2 text-center">
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'Saving…' : label}
      </Button>
    </div>
  )
}

export type AboutValues = {
  industry: string | null
  currentTitle: string | null
  bio: string | null
  linkedinUrl: string | null
  employerNote: string | null
  displayEmployerGenerally: boolean
  generalTitle: string | null
}

export function AboutStep({
  values,
  prefill,
}: {
  values: AboutValues
  prefill?: { industry?: string; currentTitle?: string; displayEmployerGenerally?: boolean } | null
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveAboutStep, {})
  const err = state.errors ?? {}
  const [generalDisplay, setGeneralDisplay] = useState(
    values.displayEmployerGenerally ?? prefill?.displayEmployerGenerally ?? false,
  )

  return (
    <form action={action} className="space-y-7">
      <Field label="What field are you in?" errors={err.industry}>
        <Select name="industry" defaultValue={values.industry ?? prefill?.industry} required>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue placeholder="Pick your field" />
          </SelectTrigger>
          <SelectContent>
            {INDUSTRIES.map((i) => (
              <SelectItem key={i} value={i}>
                {i}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="What's your current role?"
        hint="Title and company. This is what students see first."
        htmlFor="currentTitle"
        errors={err.currentTitle}
      >
        <Input
          id="currentTitle"
          name="currentTitle"
          defaultValue={values.currentTitle ?? prefill?.currentTitle ?? ''}
          placeholder="Analyst at Goldman Sachs"
          required
        />
      </Field>

      <Field
        label="Your bio"
        hint="What you help with, and the experience behind it. This is the main thing students read."
        htmlFor="bio"
        errors={err.bio}
      >
        <Textarea id="bio" name="bio" defaultValue={values.bio ?? ''} rows={7} required />
      </Field>

      <Field
        label="LinkedIn URL"
        hint="Optional. Helpful context for students."
        htmlFor="linkedinUrl"
        errors={err.linkedinUrl}
      >
        <Input
          id="linkedinUrl"
          name="linkedinUrl"
          defaultValue={values.linkedinUrl ?? ''}
          placeholder="linkedin.com/in/you"
        />
      </Field>

      <Field
        label="Anything we should know about your employer?"
        hint="Optional. E.g. restrictions on what you can discuss publicly."
        htmlFor="employerNote"
        errors={err.employerNote}
      >
        <Textarea id="employerNote" name="employerNote" defaultValue={values.employerNote ?? ''} rows={2} />
      </Field>

      <Field
        label="How should your employer show on your profile?"
        hint="Some mentors can't show their firm's name publicly."
        errors={err.generalTitle}
      >
        <div className="space-y-2">
          {[
            { value: 'show_name', label: 'Show my current role and company' },
            { value: 'describe_generally', label: 'Describe generally (e.g. Finance Professional)' },
          ].map((o) => {
            const checked = (o.value === 'describe_generally') === generalDisplay
            return (
              <label
                key={o.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  checked ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
                }`}
              >
                <input
                  type="radio"
                  name="employerVisibility"
                  value={o.value}
                  checked={checked}
                  onChange={() => setGeneralDisplay(o.value === 'describe_generally')}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`size-3.5 rounded-full border-2 ${checked ? 'border-gold bg-gold' : 'border-line/40'}`}
                />
                {o.label}
              </label>
            )
          })}
          {generalDisplay ? (
            <Input
              name="generalTitle"
              defaultValue={values.generalTitle ?? ''}
              placeholder="Finance Professional"
              aria-label="General title to show instead of your employer"
              className="mt-2"
            />
          ) : (
            <input type="hidden" name="generalTitle" value="" />
          )}
        </div>
      </Field>

      {state.message ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <SubmitRow pending={pending} label="Save and continue" />
    </form>
  )
}

export function SessionsStep({
  offerings,
}: {
  offerings: Array<{ lengthMinutes: number; priceCents: number }>
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveSessionsStep, {})
  const err = state.errors ?? {}
  const [lengths, setLengths] = useState<number[]>(
    offerings.length ? offerings.map((o) => o.lengthMinutes) : [30],
  )
  const priceFor = (len: number) => {
    const cents = offerings.find((o) => o.lengthMinutes === len)?.priceCents
    return cents ? (cents / 100).toString() : ''
  }

  return (
    <form action={action} className="space-y-7">
      <Field
        label="Sessions you offer"
        hint="Pick the lengths and set your rate for each. You keep 70 to 80%, shown on your dashboard."
        errors={err.offerings ?? err._form}
      >
        <div className="space-y-3">
          {SESSION_LENGTHS.map((len) => {
            const checked = lengths.includes(len)
            return (
              <div key={len} className="flex items-center gap-3">
                <Checkbox
                  id={`len-${len}`}
                  name="lengthMinutes"
                  value={String(len)}
                  checked={checked}
                  onCheckedChange={(c) =>
                    setLengths((prev) => (c === true ? [...prev, len] : prev.filter((l) => l !== len)))
                  }
                />
                <Label htmlFor={`len-${len}`} className="w-24 font-normal">
                  {len} minutes
                </Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate">$</span>
                  <Input
                    name={`price_${len}`}
                    defaultValue={priceFor(len)}
                    disabled={!checked}
                    inputMode="decimal"
                    placeholder="75"
                    className="w-28"
                    aria-label={`Price for a ${len} minute session, in dollars`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Field>

      {state.message ? (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <SubmitRow pending={pending} label="Save and continue" />
    </form>
  )
}

export function HandbookStep({
  signedName,
  signedAt,
}: {
  signedName: string | null
  signedAt: string | null
}) {
  const [state, action, pending] = useActionState<OnboardingState, FormData>(saveHandbookStep, {})
  const err = state.errors ?? {}

  return (
    <div className="space-y-6">
      <p className="mx-auto max-w-md text-center text-sm text-slate">
        Read the{' '}
        <Link
          href="/mentor/handbook"
          target="_blank"
          className="underline decoration-gold underline-offset-4"
        >
          Mentor Handbook
        </Link>
        , then type your full legal name to agree to it. This is what students and we rely on.
      </p>

      {signedName ? (
        <div className="mx-auto max-w-md">
          <p className="rounded-lg border border-line/20 bg-secondary p-3 text-center text-sm text-slate">
            Signed by <span className="font-medium text-ink">{signedName}</span>
            {signedAt ? (
              <> on {new Date(signedAt).toLocaleDateString('en-US', { dateStyle: 'long' })}</>
            ) : null}
            .
          </p>
          <div className="mt-6 text-center">
            <Button asChild size="lg">
              <Link href="/mentor/onboarding?step=done">Continue</Link>
            </Button>
          </div>
        </div>
      ) : (
        <form action={action} className="mx-auto max-w-md space-y-3">
          <Input
            name="handbookSignedName"
            placeholder="Your full legal name"
            aria-label="Type your full legal name to sign the Mentor Handbook"
            required
          />
          <p className="text-xs text-slate">
            Typing your name here is your signature and agreement to the handbook.
          </p>
          {err.handbookSignedName?.length ? (
            <p role="alert" className="text-sm text-destructive">
              {err.handbookSignedName[0]}
            </p>
          ) : null}
          {state.message ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : null}
          <div className="pt-2 text-center">
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? 'Signing…' : 'Sign and continue'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export function FinishButton() {
  return (
    <form action={finishOnboarding} className="text-center">
      <Button type="submit" size="lg">
        Go to my dashboard
      </Button>
    </form>
  )
}
