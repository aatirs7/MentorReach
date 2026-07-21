import 'server-only'
import { and, eq, gt, gte, inArray, lt } from 'drizzle-orm'
import { db } from '@/db'
import {
  mentorAvailabilityBlackouts,
  mentorAvailabilityRules,
  mentorProfiles,
  sessionHolds,
  sessions,
} from '@/db/schema'
import { type BusyInterval, type SlotQuery, generateSlots, slotIsBookable } from './scheduler'

/**
 * Service layer over the pure scheduler (src/lib/scheduler.ts): loads a mentor's rules,
 * blackouts, guardrail settings, and current bookings/holds from the DB, then asks the
 * pure engine for slots. Keeping DB access here means the slot math stays unit-testable.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const DEFAULT_WINDOW_DAYS = 21

type MentorSchedulingConfig = {
  timezone: string
  bufferMinutes: number
  minNoticeHours: number
  maxPerDay: number | null
}

async function loadConfig(mentorUserId: string): Promise<MentorSchedulingConfig | null> {
  const profile = await db.query.mentorProfiles.findFirst({
    where: eq(mentorProfiles.userId, mentorUserId),
    columns: { timezone: true, bookingBufferMinutes: true, minNoticeHours: true, maxBookingsPerDay: true },
  })
  if (!profile) return null
  return {
    timezone: profile.timezone,
    bufferMinutes: profile.bookingBufferMinutes,
    minNoticeHours: profile.minNoticeHours,
    maxPerDay: profile.maxBookingsPerDay,
  }
}

/** Existing bookings + live holds for a mentor as UTC busy intervals. */
async function loadBusy(mentorUserId: string, from: Date, to: Date, now: Date): Promise<BusyInterval[]> {
  const [booked, holds] = await Promise.all([
    db.query.sessions.findMany({
      where: and(
        eq(sessions.mentorId, mentorUserId),
        inArray(sessions.status, ['booked', 'rescheduled']),
        gte(sessions.scheduledStart, from),
        lt(sessions.scheduledStart, to),
      ),
      columns: { scheduledStart: true, scheduledEnd: true },
    }),
    db.query.sessionHolds.findMany({
      where: and(eq(sessionHolds.mentorId, mentorUserId), gt(sessionHolds.expiresAt, now)),
      columns: { slotStart: true, slotEnd: true },
    }),
  ])

  const busy: BusyInterval[] = []
  for (const s of booked) {
    if (s.scheduledStart && s.scheduledEnd) busy.push({ start: s.scheduledStart, end: s.scheduledEnd })
  }
  for (const h of holds) busy.push({ start: h.slotStart, end: h.slotEnd })
  return busy
}

async function buildQuery(params: {
  mentorUserId: string
  offeringLengthMin: number
  from: Date
  to: Date
  now: Date
}): Promise<SlotQuery | null> {
  const config = await loadConfig(params.mentorUserId)
  if (!config) return null

  const [rules, blackouts, busy] = await Promise.all([
    db.query.mentorAvailabilityRules.findMany({
      where: eq(mentorAvailabilityRules.mentorId, params.mentorUserId),
      columns: { weekday: true, startMinute: true, endMinute: true },
    }),
    db.query.mentorAvailabilityBlackouts.findMany({
      where: eq(mentorAvailabilityBlackouts.mentorId, params.mentorUserId),
      columns: { day: true },
    }),
    loadBusy(params.mentorUserId, new Date(params.from.getTime() - DAY_MS), new Date(params.to.getTime() + DAY_MS), params.now),
  ])

  return {
    rules,
    blackouts: blackouts.map((b) => b.day),
    busy,
    offeringLengthMin: params.offeringLengthMin,
    bufferMinutes: config.bufferMinutes,
    minNoticeHours: config.minNoticeHours,
    maxPerDay: config.maxPerDay,
    timezone: config.timezone,
    from: params.from,
    to: params.to,
    now: params.now,
  }
}

/** All bookable slot instants (UTC) for a mentor + offering length over the booking window. */
export async function getBookableSlots(params: {
  mentorUserId: string
  offeringLengthMin: number
  now: Date
  windowDays?: number
}): Promise<Date[]> {
  const to = new Date(params.now.getTime() + (params.windowDays ?? DEFAULT_WINDOW_DAYS) * DAY_MS)
  const query = await buildQuery({
    mentorUserId: params.mentorUserId,
    offeringLengthMin: params.offeringLengthMin,
    from: params.now,
    to,
    now: params.now,
  })
  return query ? generateSlots(query) : []
}

/** Is one specific slot bookable right now? Used at startBooking and payment confirmation. */
export async function isSlotOpen(params: {
  mentorUserId: string
  offeringLengthMin: number
  slotStart: Date
  now: Date
}): Promise<boolean> {
  const query = await buildQuery({
    mentorUserId: params.mentorUserId,
    offeringLengthMin: params.offeringLengthMin,
    from: new Date(params.slotStart.getTime() - DAY_MS),
    to: new Date(params.slotStart.getTime() + DAY_MS),
    now: params.now,
  })
  return query ? slotIsBookable(query, params.slotStart) : false
}

/** Does this mentor have any availability at all? Cheap check for publish/browse gating. */
export async function mentorHasAvailability(mentorUserId: string): Promise<boolean> {
  const rule = await db.query.mentorAvailabilityRules.findFirst({
    where: eq(mentorAvailabilityRules.mentorId, mentorUserId),
    columns: { id: true },
  })
  return Boolean(rule)
}
