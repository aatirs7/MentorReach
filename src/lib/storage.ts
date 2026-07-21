import 'server-only'
import { put } from '@vercel/blob'
import { env } from './env'

/**
 * Mentor headshot upload, via Vercel Blob.
 *
 * Optional integration, like Stripe/Zoom/Resend: without BLOB_READ_WRITE_TOKEN the
 * app still builds and runs, and this throws a clear message only on the one path that
 * needs it. Connecting a Blob store in the Vercel dashboard auto-injects the token.
 *
 * A real mentor must upload their own photo to publish (it's a checklist item), so photo
 * upload being unconfigured means real mentors can't go live yet — the same shape as
 * booking needing Stripe. Seed demo mentors don't use this; they carry placeholder faces.
 */
export function storageConfigured(): boolean {
  return Boolean(env.BLOB_READ_WRITE_TOKEN)
}

const MAX_BYTES = 8 * 1024 * 1024 // 8MB — generous for a phone photo, a guard not a policy
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export class UploadError extends Error {}

export async function uploadHeadshot(mentorUserId: string, file: File): Promise<string> {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new UploadError(
      'Photo upload isn’t switched on yet. Connect a Vercel Blob store to enable it.',
    )
  }

  if (!ALLOWED.has(file.type)) {
    throw new UploadError('Please upload a JPEG, PNG, or WebP image.')
  }
  if (file.size > MAX_BYTES) {
    throw new UploadError('That image is over 8MB. Please upload a smaller one.')
  }
  if (file.size === 0) {
    throw new UploadError('That file looks empty. Please choose a photo.')
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'

  // Keyed by mentor id under a mentors/ prefix; addRandomSuffix so a re-upload gets a new
  // URL (and old browser/CDN caches don't serve the previous photo).
  const blob = await put(`mentors/${mentorUserId}.${ext}`, file, {
    access: 'public',
    token,
    addRandomSuffix: true,
    contentType: file.type,
  })

  return blob.url
}

const MAX_RESUME_BYTES = 8 * 1024 * 1024 // 8MB

/**
 * Mentor resume/CV upload — same Vercel Blob store as the headshot, PDF only.
 *
 * Optional, like the headshot: without BLOB_READ_WRITE_TOKEN it throws a clear message on
 * this one path and nothing else breaks. The resume is admin-only context (shown on the
 * mentor detail page), never public, and never a publish gate — so an unconfigured Blob
 * store just means mentors can't attach one yet.
 */
export async function uploadResume(mentorUserId: string, file: File): Promise<string> {
  const token = env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    throw new UploadError(
      'Resume upload isn’t switched on yet. Connect a Vercel Blob store to enable it.',
    )
  }

  if (file.type !== 'application/pdf') {
    throw new UploadError('Please upload a PDF.')
  }
  if (file.size > MAX_RESUME_BYTES) {
    throw new UploadError('That file is over 8MB. Please upload a smaller one.')
  }
  if (file.size === 0) {
    throw new UploadError('That file looks empty. Please choose a PDF.')
  }

  const blob = await put(`resumes/${mentorUserId}.pdf`, file, {
    access: 'public',
    token,
    addRandomSuffix: true,
    contentType: file.type,
  })

  return blob.url
}
