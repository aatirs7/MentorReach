'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { mentorAvailabilityBlackouts, mentorAvailabilityRules, mentorProfiles } from '@/db/schema'
import { requireUser, viewingAsMentor } from '@/lib/auth/guards'
import { COMMON_TIMEZONES, hhmmToMinutes } from '@/lib/timezones'

export type AvailabilityState = { error?: string; success?: string }

const READ_ONLY = 'You’re viewing as a mentor (read-only). Exit mentor view to make changes.'

/** Guard shared by every write here: mentor-only, and never while previewing as admin. */
async function editingMentor(): Promise<
  { ok: true; userId: string } | { ok: false; state: AvailabilityState }
> {
  const user = await requireUser()
  if (await viewingAsMentor()) return { ok: false, state: { error: READ_ONLY } }
  if (user.role !== 'mentor') return { ok: false, state: { error: 'Only mentors can do this.' } }
  return { ok: true, userId: user.id }
}

function revalidate() {
  revalidatePath('/mentor/availability')
  revalidatePath('/mentor/onboarding')
  revalidatePath('/mentor')
}

export async function saveSchedulingSettings(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const gate = await editingMentor()
  if (!gate.ok) return gate.state

  const timezone = String(formData.get('timezone') ?? '')
  if (!COMMON_TIMEZONES.some((t) => t.value === timezone)) {
    return { error: 'Pick a timezone from the list.' }
  }

  const buffer = clampInt(formData.get('bufferMinutes'), 0, 120, 0)
  const minNotice = clampInt(formData.get('minNoticeHours'), 0, 168, 12)
  const maxRaw = String(formData.get('maxBookingsPerDay') ?? '').trim()
  const maxPerDay = maxRaw === '' ? null : clampInt(maxRaw, 1, 50, 1)

  await db
    .update(mentorProfiles)
    .set({
      timezone,
      bookingBufferMinutes: buffer,
      minNoticeHours: minNotice,
      maxBookingsPerDay: maxPerDay,
    })
    .where(eq(mentorProfiles.userId, gate.userId))

  revalidate()
  return { success: 'Scheduling settings saved.' }
}

export async function addAvailabilityRule(formData: FormData): Promise<void> {
  const gate = await editingMentor()
  if (!gate.ok) return

  const weekday = Number(formData.get('weekday'))
  const start = hhmmToMinutes(String(formData.get('start') ?? ''))
  const end = hhmmToMinutes(String(formData.get('end') ?? ''))

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) return
  if (start == null || end == null || start >= end) return

  await db.insert(mentorAvailabilityRules).values({
    mentorId: gate.userId,
    weekday,
    startMinute: start,
    endMinute: end,
  })

  revalidate()
}

export async function removeAvailabilityRule(formData: FormData): Promise<void> {
  const gate = await editingMentor()
  if (!gate.ok) return

  const id = String(formData.get('id') ?? '')
  if (!id) return
  await db
    .delete(mentorAvailabilityRules)
    .where(and(eq(mentorAvailabilityRules.id, id), eq(mentorAvailabilityRules.mentorId, gate.userId)))
  revalidate()
}

export async function addBlackout(formData: FormData): Promise<void> {
  const gate = await editingMentor()
  if (!gate.ok) return

  const day = String(formData.get('day') ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return

  await db
    .insert(mentorAvailabilityBlackouts)
    .values({ mentorId: gate.userId, day })
    .onConflictDoNothing({ target: [mentorAvailabilityBlackouts.mentorId, mentorAvailabilityBlackouts.day] })
  revalidate()
}

export async function removeBlackout(formData: FormData): Promise<void> {
  const gate = await editingMentor()
  if (!gate.ok) return

  const id = String(formData.get('id') ?? '')
  if (!id) return
  await db
    .delete(mentorAvailabilityBlackouts)
    .where(and(eq(mentorAvailabilityBlackouts.id, id), eq(mentorAvailabilityBlackouts.mentorId, gate.userId)))
  revalidate()
}

function clampInt(value: FormDataEntryValue | string | null, min: number, max: number, fallback: number): number {
  const n = Number(String(value ?? '').trim())
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}
