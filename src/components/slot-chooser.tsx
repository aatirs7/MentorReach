'use client'

import { useMemo, useState } from 'react'

/**
 * Presentational day + time picker over a list of UTC slot instants (ISO strings). Renders
 * a hidden radio group named `slotStart` whose value is the chosen ISO instant, so it drops
 * straight into a form. Times are shown in the viewer's own timezone. Fetching is the
 * parent's job — this is pure UI, reused by the booking panel and the reschedule box.
 */
export function SlotChooser({
  slots,
  loading,
  emptyText = 'No open times in the next few weeks. Check back soon.',
}: {
  slots: string[]
  loading: boolean
  emptyText?: string
}) {
  const [day, setDay] = useState('')
  const [picked, setPicked] = useState('')

  const byDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const iso of slots) {
      const key = new Date(iso).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
      const list = map.get(key)
      if (list) list.push(iso)
      else map.set(key, [iso])
    }
    return map
  }, [slots])

  const days = [...byDay.keys()]
  const activeDay = day && byDay.has(day) ? day : (days[0] ?? '')
  const times = byDay.get(activeDay) ?? []

  if (loading) return <p className="mt-3 text-sm text-slate">Loading times…</p>
  if (days.length === 0) return <p className="mt-3 text-sm text-slate">{emptyText}</p>

  return (
    <div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setDay(d)
              setPicked('')
            }}
            aria-pressed={d === activeDay}
            className={`shrink-0 rounded-full px-3 py-1 text-sm transition-colors ${
              d === activeDay ? 'bg-ink text-paper' : 'text-slate hover:text-ink'
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {times.map((iso) => {
          const label = new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
          const isPicked = picked === iso
          return (
            <label
              key={iso}
              className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-sm transition-colors ${
                isPicked ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
              }`}
            >
              <input
                type="radio"
                name="slotStart"
                value={iso}
                checked={isPicked}
                onChange={() => setPicked(iso)}
                className="sr-only"
              />
              {label}
            </label>
          )
        })}
      </div>
    </div>
  )
}
