'use client'

import { useActionState, useMemo, useState } from 'react'
import { submitSurvey, type SurveyState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  COLLEGE_YEARS,
  HELP_OPTIONS,
  HS_GRADES,
  PATH_CERTAINTY_LABELS,
} from '@/lib/survey-schema'

type Existing = {
  educationLevel: 'hs' | 'college'
  gradeYear: string
  school: string
  major: string | null
  careerInterest: string
  target: string | null
  pathCertainty: number
  priorExperience: string | null
  helpWith: string[]
  helpWithOther: string | null
  heardFrom: string | null
} | null

/**
 * Spec §7 — the mandatory student survey, as a step-through rather than a wall of ten
 * questions.
 *
 * WHY A WIZARD: this is the last thing between a student and browsing, and a single page
 * of ten fields reads as paperwork — the highest-drop-off shape there is. One question at
 * a time is the marketplace onboarding convention (Preply, Airbnb) because each screen
 * asks one small thing and progress is visible.
 *
 * All ten §7 questions are preserved exactly, and so is the server contract: every field
 * stays mounted (hidden steps are just `hidden`), so the single form submit still posts
 * the same FormData to the same unchanged action. Nothing about the storage or the §2.3
 * gate changed — this is layout only.
 *
 * Client-side step validation is for flow, not for trust: submitSurvey re-parses
 * everything with the same Zod schema regardless.
 */
export function SurveyForm({ existing }: { existing: Existing }) {
  const [state, action, pending] = useActionState<SurveyState, FormData>(submitSurvey, {})

  const [level, setLevel] = useState<'hs' | 'college' | ''>(existing?.educationLevel ?? '')
  const [gradeYear, setGradeYear] = useState(existing?.gradeYear ?? '')
  const [school, setSchool] = useState(existing?.school ?? '')
  const [major, setMajor] = useState(existing?.major ?? '')
  const [careerInterest, setCareerInterest] = useState(existing?.careerInterest ?? '')
  const [target, setTarget] = useState(existing?.target ?? '')
  const [pathCertainty, setPathCertainty] = useState(String(existing?.pathCertainty ?? ''))
  const [priorExperience, setPriorExperience] = useState(existing?.priorExperience ?? '')
  const [help, setHelp] = useState<string[]>(existing?.helpWith ?? [])
  const [helpWithOther, setHelpWithOther] = useState(existing?.helpWithOther ?? '')
  const [heardFrom, setHeardFrom] = useState(existing?.heardFrom ?? '')

  const [step, setStep] = useState(0)
  const [touched, setTouched] = useState(false)

  /** Q4 only exists for college, so the step list itself changes with Q1. */
  const steps = useMemo(() => {
    const s: StepDef[] = [
      { id: 'level', valid: () => level !== '' },
      { id: 'grade', valid: () => gradeYear !== '' },
      { id: 'school', valid: () => school.trim().length > 0 && (level !== 'college' || major.trim().length > 0) },
      { id: 'career', valid: () => careerInterest.trim().length > 0 },
      { id: 'certainty', valid: () => pathCertainty !== '' },
      { id: 'help', valid: () => help.length > 0 && (!help.includes('Other') || helpWithOther.trim().length > 0) },
      { id: 'extras', valid: () => true },
    ]
    return s
  }, [level, gradeYear, school, major, careerInterest, pathCertainty, help, helpWithOther])

  const current = steps[step]
  const isLast = step === steps.length - 1
  const canAdvance = current.valid()

  function next() {
    if (!canAdvance) {
      setTouched(true)
      return
    }
    setTouched(false)
    setStep((s) => Math.min(s + 1, steps.length - 1))
  }

  function back() {
    setTouched(false)
    setStep((s) => Math.max(s - 1, 0))
  }

  function toggleHelp(option: string) {
    setHelp((prev) => (prev.includes(option) ? prev.filter((h) => h !== option) : [...prev, option]))
  }

  const err = state.errors ?? {}

  return (
    <form action={action} className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* ------------------------------------------------ LEFT: context panel */}
      <aside className="relative overflow-hidden bg-ink px-6 py-10 text-paper lg:w-[38%] lg:px-12 lg:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, var(--gold), transparent 70%)' }}
        />
        <div className="relative lg:sticky lg:top-16">
          <p className="font-mono text-xs tracking-widest text-gold uppercase">
            Step {step + 1} of {steps.length}
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight lg:text-4xl">
            Tell us where you&rsquo;re headed
          </h1>
          <p className="mt-4 max-w-sm leading-relaxed text-paper/60">
            This is how we match you with coaches who&rsquo;ve actually done the thing
            you&rsquo;re trying to do. It takes about a minute.
          </p>

          {/* Progress. Visible progress is most of why a wizard beats a long form. */}
          <div className="mt-8 flex gap-1.5" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-gold' : 'bg-paper/15'
                }`}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* ----------------------------------------------------- RIGHT: question */}
      <div className="flex flex-1 items-center justify-center px-6 py-12 lg:py-16">
        <div className="w-full max-w-lg">
          {/* Q1 */}
          <Step active={current.id === 'level'} question="Are you in high school or college?">
            <ChoiceList
              name="educationLevel"
              value={level}
              onChange={(v) => {
                setLevel(v as 'hs' | 'college')
                setGradeYear('') // Q2's options depend on Q1; a stale answer would be invalid.
              }}
              options={[
                { value: 'hs', label: 'High school' },
                { value: 'college', label: 'College' },
              ]}
            />
          </Step>

          {/* Q2 — options depend on Q1 */}
          <Step
            active={current.id === 'grade'}
            question={level === 'hs' ? 'What grade are you in?' : 'What year are you?'}
          >
            <ChoiceList
              name="gradeYear"
              value={gradeYear}
              onChange={setGradeYear}
              columns
              options={(level === 'hs' ? HS_GRADES : COLLEGE_YEARS).map((g) => ({
                value: g,
                label: g,
              }))}
            />
          </Step>

          {/* Q3 + Q4 */}
          <Step active={current.id === 'school'} question="Where do you study?">
            <div className="space-y-5">
              <div>
                <Label htmlFor="school" className="text-sm font-normal text-slate">
                  School name
                </Label>
                <Input
                  id="school"
                  name="school"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  maxLength={200}
                  className="mt-2 h-12 text-base"
                />
              </div>

              {level === 'college' ? (
                <div>
                  <Label htmlFor="major" className="text-sm font-normal text-slate">
                    Major, or intended major
                  </Label>
                  <Input
                    id="major"
                    name="major"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    maxLength={200}
                    className="mt-2 h-12 text-base"
                  />
                </div>
              ) : (
                /* Keep the field mounted so FormData shape never changes with the branch. */
                <input type="hidden" name="major" value="" />
              )}
            </div>
          </Step>

          {/* Q5 + Q6 */}
          <Step active={current.id === 'career'} question="What are you aiming for?">
            <div className="space-y-5">
              <div>
                <Label htmlFor="careerInterest" className="text-sm font-normal text-slate">
                  Field or career you&rsquo;re interested in
                </Label>
                <Input
                  id="careerInterest"
                  name="careerInterest"
                  value={careerInterest}
                  onChange={(e) => setCareerInterest(e.target.value)}
                  placeholder="Investment banking, software, medicine…"
                  className="mt-2 h-12 text-base"
                />
              </div>
              <div>
                <Label htmlFor="target" className="text-sm font-normal text-slate">
                  A specific company, industry or role? <span className="text-slate">Optional</span>
                </Label>
                <Input
                  id="target"
                  name="target"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="mt-2 h-12 text-base"
                />
              </div>
            </div>
          </Step>

          {/* Q7 */}
          <Step active={current.id === 'certainty'} question="How set are you on that path?">
            <ChoiceList
              name="pathCertainty"
              value={pathCertainty}
              onChange={setPathCertainty}
              options={Object.entries(PATH_CERTAINTY_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
            />
          </Step>

          {/* Q9 */}
          <Step
            active={current.id === 'help'}
            question="What do you want help with?"
            hint="Pick as many as apply."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {HELP_OPTIONS.map((option) => {
                const checked = help.includes(option)
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                      checked ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="helpWith"
                      value={option}
                      checked={checked}
                      onChange={() => toggleHelp(option)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className={`flex size-4 shrink-0 items-center justify-center rounded-sm border text-[10px] ${
                        checked ? 'border-gold bg-gold text-ink' : 'border-line/40'
                      }`}
                    >
                      {checked ? '✓' : ''}
                    </span>
                    {option}
                  </label>
                )
              })}
            </div>

            {help.includes('Other') ? (
              <Input
                name="helpWithOther"
                value={helpWithOther}
                onChange={(e) => setHelpWithOther(e.target.value)}
                placeholder="Tell us what else"
                aria-label="What else do you want help with?"
                className="mt-3 h-12 text-base"
              />
            ) : (
              <input type="hidden" name="helpWithOther" value="" />
            )}
          </Step>

          {/* Q8 + Q10 */}
          <Step
            active={current.id === 'extras'}
            question="Last two, both optional"
            hint="Skip either if you'd rather."
          >
            <div className="space-y-5">
              <div>
                <Label htmlFor="priorExperience" className="text-sm font-normal text-slate">
                  Any internships, jobs or relevant experience so far?
                </Label>
                <Textarea
                  id="priorExperience"
                  name="priorExperience"
                  value={priorExperience}
                  onChange={(e) => setPriorExperience(e.target.value)}
                  rows={3}
                  className="mt-2 text-base"
                />
              </div>
              <div>
                <Label htmlFor="heardFrom" className="text-sm font-normal text-slate">
                  How did you hear about Trajectory?
                </Label>
                <Input
                  id="heardFrom"
                  name="heardFrom"
                  value={heardFrom}
                  onChange={(e) => setHeardFrom(e.target.value)}
                  className="mt-2 h-12 text-base"
                />
              </div>
            </div>
          </Step>

          {/* Server-side errors: shown wherever the user is, since the action re-validates
              the whole survey, not just the visible step. */}
          {state.message ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {state.message}
              {Object.values(err).flat().length ? ` (${Object.values(err).flat()[0]})` : ''}
            </p>
          ) : null}

          {touched && !canAdvance ? (
            <p role="alert" className="mt-6 text-sm text-destructive">
              {current.id === 'help'
                ? 'Pick at least one, and tell us what “Other” means if you chose it.'
                : 'Please answer this one to carry on.'}
            </p>
          ) : null}

          <div className="mt-10 flex items-center gap-3">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={back} disabled={pending}>
                Back
              </Button>
            ) : null}

            {isLast ? (
              <Button type="submit" size="lg" disabled={pending} className="ml-auto">
                {pending ? 'Saving…' : 'Finish and browse coaches'}
              </Button>
            ) : (
              <Button
                type="button"
                size="lg"
                onClick={next}
                disabled={!canAdvance}
                className="ml-auto"
              >
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}

type StepDef = { id: string; valid: () => boolean }

/**
 * Hidden, not unmounted: every field stays in the DOM so the single submit posts the
 * complete FormData the server action already expects.
 */
function Step({
  active,
  question,
  hint,
  children,
}: {
  active: boolean
  question: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className={active ? '' : 'hidden'} aria-hidden={!active}>
      <h2 className="font-display text-2xl leading-snug lg:text-3xl">{question}</h2>
      {hint ? <p className="mt-2 text-sm text-slate">{hint}</p> : null}
      <div className="mt-7">{children}</div>
    </div>
  )
}

/** Big tappable option rows — the onboarding convention, and far easier than a radio dot. */
function ChoiceList({
  name,
  value,
  onChange,
  options,
  columns,
}: {
  name: string
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
  columns?: boolean
}) {
  return (
    <div className={columns ? 'grid gap-2 sm:grid-cols-2' : 'space-y-2'}>
      {options.map((o) => {
        const checked = value === o.value
        return (
          <label
            key={o.value}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-4 py-3.5 text-base transition-colors ${
              checked ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
            }`}
          >
            <span>{o.label}</span>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={checked}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={`size-4 shrink-0 rounded-full border-2 transition-colors ${
                checked ? 'border-gold bg-gold' : 'border-line/40'
              }`}
            />
          </label>
        )
      })}
    </div>
  )
}
