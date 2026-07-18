import 'server-only'
import { env, requireEnv } from './env'

/**
 * Zoom video meetings for the native scheduler.
 *
 * One platform Zoom account, Server-to-Server OAuth. A meeting is created per booking; the
 * coach gets the host link (start_url), both parties the join link (join_url).
 *
 * Optional integration like Stripe/Resend: without keys `zoomConfigured()` is false and the
 * Book button is gated with an honest reason. `requireEnv()` throws a clear message only on
 * the one path that needs a key — never at module scope (that would break `next build`).
 */
export class ZoomError extends Error {}

export function zoomConfigured(): boolean {
  return Boolean(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET)
}

// --- OAuth token (cached to its expiry) -------------------------------------

let token: { value: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now() + 60_000) return token.value

  const accountId = requireEnv('ZOOM_ACCOUNT_ID', 'Zoom meetings')
  const clientId = requireEnv('ZOOM_CLIENT_ID', 'Zoom meetings')
  const clientSecret = requireEnv('ZOOM_CLIENT_SECRET', 'Zoom meetings')
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  )

  if (!res.ok) {
    throw new ZoomError(`Zoom OAuth failed (${res.status}): ${await res.text()}`)
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return token.value
}

async function zoomFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const bearer = await accessToken()
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    throw new ZoomError(`Zoom API ${init.method ?? 'GET'} ${path} failed (${res.status}): ${await res.text()}`)
  }
  return res
}

// --- Meetings ---------------------------------------------------------------

export type ZoomMeeting = { id: string; joinUrl: string; startUrl: string }

/**
 * Create a scheduled meeting on the platform account.
 * `startIso` is an absolute instant; `timezone` is only for how Zoom labels it to invitees.
 */
export async function createMeeting(params: {
  topic: string
  startIso: string
  durationMin: number
  timezone: string
}): Promise<ZoomMeeting> {
  const res = await zoomFetch('/users/me/meetings', {
    method: 'POST',
    body: JSON.stringify({
      topic: params.topic,
      type: 2, // scheduled
      start_time: params.startIso,
      duration: params.durationMin,
      timezone: params.timezone,
      settings: { join_before_host: false, waiting_room: true },
    }),
  })
  const json = (await res.json()) as { id: number; join_url: string; start_url: string }
  return { id: String(json.id), joinUrl: json.join_url, startUrl: json.start_url }
}

/** Move an existing meeting to a new time (for reschedule). */
export async function updateMeeting(
  meetingId: string,
  params: { startIso: string; durationMin: number },
): Promise<void> {
  await zoomFetch(`/meetings/${meetingId}`, {
    method: 'PATCH',
    body: JSON.stringify({ start_time: params.startIso, duration: params.durationMin }),
  })
}

/** Delete a meeting (on cancel). */
export async function deleteMeeting(meetingId: string): Promise<void> {
  await zoomFetch(`/meetings/${meetingId}`, { method: 'DELETE' })
}
