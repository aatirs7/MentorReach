'use client'

import { useActionState } from 'react'
import {
  addAvailabilityRule,
  addBlackout,
  type AvailabilityState,
  removeAvailabilityRule,
  removeBlackout,
  saveSchedulingSettings,
} from './actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { COMMON_TIMEZONES, WEEKDAYS, minutesToLabel } from '@/lib/timezones'

export type RuleView = { id: string; weekday: number; startMinute: number; endMinute: number }
export type BlackoutView = { id: string; day: string }
export type SchedulingSettings = {
  timezone: string
  bufferMinutes: number
  minNoticeHours: number
  maxBookingsPerDay: number | null
}

export function AvailabilityEditor({
  rules,
  blackouts,
  settings,
  readOnly = false,
}: {
  rules: RuleView[]
  blackouts: BlackoutView[]
  settings: SchedulingSettings
  readOnly?: boolean
}) {
  return (
    <div className="space-y-8">
      <SettingsCard settings={settings} readOnly={readOnly} />
      <WeeklyHours rules={rules} readOnly={readOnly} />
      <Blackouts blackouts={blackouts} readOnly={readOnly} />
    </div>
  )
}

function SettingsCard({ settings, readOnly }: { settings: SchedulingSettings; readOnly: boolean }) {
  const [state, action, pending] = useActionState<AvailabilityState, FormData>(saveSchedulingSettings, {})

  return (
    <Card className="border-line/20 p-6">
      <p className="label-mono">Timezone &amp; rules</p>
      <form action={action} className="mt-4 space-y-4">
        <div>
          <Label htmlFor="timezone">Your timezone</Label>
          <Select name="timezone" defaultValue={settings.timezone} disabled={readOnly}>
            <SelectTrigger id="timezone" className="mt-1 w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-slate">Your weekly hours are set in this timezone.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="minNoticeHours">Minimum notice (hours)</Label>
            <Input id="minNoticeHours" name="minNoticeHours" type="number" min={0} max={168} defaultValue={settings.minNoticeHours} disabled={readOnly} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="bufferMinutes">Buffer between sessions (min)</Label>
            <Input id="bufferMinutes" name="bufferMinutes" type="number" min={0} max={120} defaultValue={settings.bufferMinutes} disabled={readOnly} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="maxBookingsPerDay">Max sessions/day (blank = no cap)</Label>
            <Input id="maxBookingsPerDay" name="maxBookingsPerDay" type="number" min={1} max={50} defaultValue={settings.maxBookingsPerDay ?? ''} disabled={readOnly} className="mt-1" />
          </div>
        </div>

        {state.error ? <p role="alert" className="text-sm text-destructive">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-slate">{state.success}</p> : null}

        {!readOnly ? (
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? 'Saving…' : 'Save settings'}
          </Button>
        ) : null}
      </form>
    </Card>
  )
}

function WeeklyHours({ rules, readOnly }: { rules: RuleView[]; readOnly: boolean }) {
  return (
    <Card className="border-line/20 p-6">
      <p className="label-mono">Weekly hours</p>
      <p className="mt-2 text-sm text-slate">
        Add the times you&rsquo;re available to mentor. Students only ever see these hours.
      </p>

      <div className="mt-4 space-y-4">
        {WEEKDAYS.map((wd) => {
          const dayRules = rules
            .filter((r) => r.weekday === wd.value)
            .sort((a, b) => a.startMinute - b.startMinute)
          return (
            <div key={wd.value} className="border-t border-line/12 pt-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-sm font-medium">{wd.label}</span>
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  {dayRules.length === 0 ? (
                    <span className="text-sm text-slate">Unavailable</span>
                  ) : (
                    dayRules.map((r) => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1.5 rounded-full border border-line/25 bg-secondary px-3 py-1 text-sm"
                      >
                        {minutesToLabel(r.startMinute)} – {minutesToLabel(r.endMinute)}
                        {!readOnly ? (
                          <form action={removeAvailabilityRule}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" aria-label="Remove" className="text-slate hover:text-destructive">
                              ×
                            </button>
                          </form>
                        ) : null}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {!readOnly ? (
                <form action={addAvailabilityRule} className="mt-2 flex flex-wrap items-center gap-2 pl-24">
                  <input type="hidden" name="weekday" value={wd.value} />
                  <input type="time" name="start" required aria-label={`${wd.label} start`} className="rounded-md border border-line/25 bg-raised px-2 py-1 text-sm" />
                  <span className="text-slate">to</span>
                  <input type="time" name="end" required aria-label={`${wd.label} end`} className="rounded-md border border-line/25 bg-raised px-2 py-1 text-sm" />
                  <Button type="submit" size="sm" variant="ghost">
                    + Add
                  </Button>
                </form>
              ) : null}
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Blackouts({ blackouts, readOnly }: { blackouts: BlackoutView[]; readOnly: boolean }) {
  const sorted = [...blackouts].sort((a, b) => a.day.localeCompare(b.day))
  return (
    <Card className="border-line/20 p-6">
      <p className="label-mono">Blocked dates</p>
      <p className="mt-2 text-sm text-slate">
        One-off days you&rsquo;re unavailable (vacation, exceptions). Your weekly hours don&rsquo;t
        apply on these dates.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {sorted.length === 0 ? (
          <span className="text-sm text-slate">None.</span>
        ) : (
          sorted.map((b) => (
            <span key={b.id} className="flex items-center gap-1.5 rounded-full border border-line/25 bg-secondary px-3 py-1 text-sm">
              {new Date(`${b.day}T00:00`).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              {!readOnly ? (
                <form action={removeBlackout}>
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" aria-label="Remove" className="text-slate hover:text-destructive">
                    ×
                  </button>
                </form>
              ) : null}
            </span>
          ))
        )}
      </div>

      {!readOnly ? (
        <form action={addBlackout} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="date" name="day" required aria-label="Blocked date" className="rounded-md border border-line/25 bg-raised px-2 py-1 text-sm" />
          <Button type="submit" size="sm" variant="ghost">
            + Block date
          </Button>
        </form>
      ) : null}
    </Card>
  )
}
