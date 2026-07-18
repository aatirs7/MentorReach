import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime } from 'luxon'
import { type SlotQuery, generateSlots, slotIsBookable } from './scheduler'

const TZ = 'America/New_York'

/** A UTC Date for a wall-clock time in TZ. */
function local(iso: string): Date {
  return DateTime.fromISO(iso, { zone: TZ }).toJSDate()
}

/** Base query: Monday 2024-06-03, 9:00–11:00 availability, 60-min sessions, 30-min grid. */
function baseQuery(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    rules: [{ weekday: 1, startMinute: 9 * 60, endMinute: 11 * 60 }], // Mon 09:00–11:00
    blackouts: [],
    busy: [],
    offeringLengthMin: 60,
    bufferMinutes: 0,
    minNoticeHours: 0,
    maxPerDay: null,
    timezone: TZ,
    from: local('2024-06-03T00:00'),
    to: local('2024-06-03T23:59'),
    now: local('2024-06-03T00:00'),
    gridMinutes: 30,
    ...overrides,
  }
}

describe('generateSlots', () => {
  it('produces grid-aligned slots that fit inside the availability window', () => {
    const slots = generateSlots(baseQuery())
    // 60-min sessions on a 30-min grid within 09:00–11:00 → starts 09:00, 09:30, 10:00.
    assert.equal(slots.length, 3)
    assert.equal(slots[0].getTime(), local('2024-06-03T09:00').getTime())
    assert.equal(slots[1].getTime(), local('2024-06-03T09:30').getTime())
    assert.equal(slots[2].getTime(), local('2024-06-03T10:00').getTime())
  })

  it('excludes slots inside the minimum-notice window', () => {
    const slots = generateSlots(baseQuery({ now: local('2024-06-03T08:30'), minNoticeHours: 1 }))
    // earliest = 09:30, so 09:00 is dropped.
    assert.equal(slots.length, 2)
    assert.equal(slots[0].getTime(), local('2024-06-03T09:30').getTime())
  })

  it('excludes slots overlapping an existing booking', () => {
    const slots = generateSlots(
      baseQuery({ busy: [{ start: local('2024-06-03T09:00'), end: local('2024-06-03T10:00') }] }),
    )
    // 09:00 and 09:30 overlap the booking; only 10:00 survives.
    assert.equal(slots.length, 1)
    assert.equal(slots[0].getTime(), local('2024-06-03T10:00').getTime())
  })

  it('applies the buffer around existing bookings', () => {
    const slots = generateSlots(
      baseQuery({
        bufferMinutes: 30,
        busy: [{ start: local('2024-06-03T09:00'), end: local('2024-06-03T10:00') }],
      }),
    )
    // With a 30-min buffer the 10:00 slot is now too close to the 09:00–10:00 booking.
    assert.equal(slots.length, 0)
  })

  it('drops a full day once the daily cap is reached', () => {
    const slots = generateSlots(
      baseQuery({
        maxPerDay: 1,
        busy: [{ start: local('2024-06-03T09:00'), end: local('2024-06-03T10:00') }],
      }),
    )
    assert.equal(slots.length, 0)
  })

  it('skips blackout dates', () => {
    const slots = generateSlots(baseQuery({ blackouts: ['2024-06-03'] }))
    assert.equal(slots.length, 0)
  })

  it('handles the spring-forward DST boundary correctly', () => {
    // 2024-03-10 (Sunday), America/New_York jumps 02:00 → 03:00. Availability 01:00–05:00.
    const slots = generateSlots({
      rules: [{ weekday: 0, startMinute: 60, endMinute: 300 }], // Sun 01:00–05:00
      blackouts: [],
      busy: [],
      offeringLengthMin: 60,
      bufferMinutes: 0,
      minNoticeHours: 0,
      maxPerDay: null,
      timezone: TZ,
      from: local('2024-03-10T00:00'),
      to: local('2024-03-11T00:00'),
      now: local('2024-03-10T00:00'),
      gridMinutes: 60,
    })
    // Wall starts 01:00(EST), 02:00(gap→03:00), 03:00(EDT), 04:00(EDT). The 02:00 and 03:00
    // collapse to the same instant (07:00Z), so distinct instants are 06:00Z, 07:00Z, 08:00Z.
    const utc = slots.map((s) => s.toISOString())
    assert.deepEqual(utc, [
      '2024-03-10T06:00:00.000Z',
      '2024-03-10T07:00:00.000Z',
      '2024-03-10T08:00:00.000Z',
    ])
  })
})

describe('slotIsBookable', () => {
  it('accepts a valid open slot', () => {
    assert.equal(slotIsBookable(baseQuery(), local('2024-06-03T09:30')), true)
  })

  it('rejects a slot that is off-grid or outside availability', () => {
    assert.equal(slotIsBookable(baseQuery(), local('2024-06-03T12:00')), false)
    assert.equal(slotIsBookable(baseQuery(), local('2024-06-03T09:07')), false)
  })

  it('rejects a slot that conflicts with a booking', () => {
    const q = baseQuery({ busy: [{ start: local('2024-06-03T09:00'), end: local('2024-06-03T10:00') }] })
    assert.equal(slotIsBookable(q, local('2024-06-03T09:00')), false)
    assert.equal(slotIsBookable(q, local('2024-06-03T10:00')), true)
  })
})
