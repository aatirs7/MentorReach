import { DateTime } from 'luxon'

/**
 * Native slot generation — pure, no I/O (like src/lib/commission.ts), so it's unit-testable
 * and can't disagree with itself between the picker and the booking guard.
 *
 * A coach declares recurring weekly hours in their own timezone plus blackout dates; we
 * generate bookable slots of a given length, minus their existing bookings/holds, minus a
 * buffer, respecting a minimum notice and an optional daily cap. Everything crossing the
 * I/O boundary is a UTC `Date` (a real instant); wall-clock math happens in the coach's
 * zone via luxon so DST is handled correctly.
 */

export type AvailabilityRule = {
  /** 0 = Sunday … 6 = Saturday (JS getDay convention). */
  weekday: number
  /** Minutes from local midnight. */
  startMinute: number
  endMinute: number
}

/** A busy interval (an existing booking or a live hold), as UTC instants. */
export type BusyInterval = { start: Date; end: Date }

export type SlotQuery = {
  rules: AvailabilityRule[]
  /** Local calendar dates (YYYY-MM-DD, coach timezone) the coach is fully unavailable. */
  blackouts: string[]
  busy: BusyInterval[]
  offeringLengthMin: number
  bufferMinutes: number
  minNoticeHours: number
  maxPerDay: number | null
  /** IANA timezone the rules are declared in. */
  timezone: string
  /** Window to search, as UTC instants. */
  from: Date
  to: Date
  now: Date
  /** Candidate-start granularity in minutes. Default 15. */
  gridMinutes?: number
}

const DAY_MS = 24 * 60 * 60 * 1000

/** JS weekday (0=Sun..6=Sat) from a luxon DateTime (luxon weekday is 1=Mon..7=Sun). */
function jsWeekday(dt: DateTime): number {
  return dt.weekday % 7
}

function localDateKey(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: timezone }).toISODate() ?? ''
}

/**
 * All bookable slot-start instants (UTC) in [from, to], ascending and de-duplicated.
 */
export function generateSlots(q: SlotQuery): Date[] {
  const grid = q.gridMinutes ?? 15
  const buffer = q.bufferMinutes
  const earliest = new Date(Math.max(q.from.getTime(), q.now.getTime() + q.minNoticeHours * 3600_000))
  const blackout = new Set(q.blackouts)

  // Pre-count existing bookings per local day for the daily cap.
  const perDayCount = new Map<string, number>()
  if (q.maxPerDay != null) {
    for (const b of q.busy) {
      const key = localDateKey(b.start, q.timezone)
      perDayCount.set(key, (perDayCount.get(key) ?? 0) + 1)
    }
  }

  const out: number[] = []
  const seen = new Set<number>()

  // Walk each local calendar date in the window (pad a day each side for tz offset).
  let cursor = DateTime.fromJSDate(new Date(q.from.getTime() - DAY_MS), { zone: q.timezone }).startOf('day')
  const stop = DateTime.fromJSDate(new Date(q.to.getTime() + DAY_MS), { zone: q.timezone }).startOf('day')

  for (; cursor <= stop; cursor = cursor.plus({ days: 1 })) {
    const dateKey = cursor.toISODate() ?? ''
    if (blackout.has(dateKey)) continue

    if (q.maxPerDay != null && (perDayCount.get(dateKey) ?? 0) >= q.maxPerDay) continue

    const weekday = jsWeekday(cursor)
    const rules = q.rules.filter((r) => r.weekday === weekday)
    if (rules.length === 0) continue

    for (const rule of rules) {
      for (let m = rule.startMinute; m + q.offeringLengthMin <= rule.endMinute; m += grid) {
        const startLocal = cursor.set({ hour: Math.floor(m / 60), minute: m % 60, second: 0, millisecond: 0 })
        if (!startLocal.isValid) continue // nonexistent wall time (spring-forward gap)

        const startUtc = startLocal.toUTC().toJSDate()
        const endUtc = startLocal.plus({ minutes: q.offeringLengthMin }).toUTC().toJSDate()

        if (startUtc < earliest) continue
        if (endUtc > q.to) continue

        // Buffer-expanded conflict with any busy interval.
        const conflict = q.busy.some((b) => {
          const bStart = b.start.getTime() - buffer * 60_000
          const bEnd = b.end.getTime() + buffer * 60_000
          return startUtc.getTime() < bEnd && endUtc.getTime() > bStart
        })
        if (conflict) continue

        const t = startUtc.getTime()
        if (!seen.has(t)) {
          seen.add(t)
          out.push(t)
        }
      }
    }
  }

  return out.sort((a, b) => a - b).map((t) => new Date(t))
}

/**
 * Is one specific slot bookable right now? Used server-side at startBooking and again at
 * payment confirmation. The caller passes a `from`/`to` that brackets the candidate's local
 * day so the daily-cap and buffer context is complete.
 */
export function slotIsBookable(q: SlotQuery, candidateStart: Date): boolean {
  const target = candidateStart.getTime()
  return generateSlots(q).some((s) => s.getTime() === target)
}

/** Convenience: group a flat list of slot instants by local date, for a calendar UI. */
export function groupSlotsByLocalDate(slots: Date[], timezone: string): Map<string, Date[]> {
  const map = new Map<string, Date[]>()
  for (const s of slots) {
    const key = localDateKey(s, timezone)
    const list = map.get(key)
    if (list) list.push(s)
    else map.set(key, [s])
  }
  return map
}
