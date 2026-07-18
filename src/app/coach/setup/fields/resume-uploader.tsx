'use client'

import { useActionState } from 'react'
import { type CoachSetupState, uploadResumeAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

/**
 * Resume/CV upload (PDF), its own form/action like the headshot. Optional and admin-only
 * visible — never shown on the public profile, never a publish gate. Shared by setup and
 * the onboarding photo/resume step.
 */
export function ResumeUploader({
  resumeUrl,
  canUpload,
  readOnlyNote,
}: {
  resumeUrl: string | null
  canUpload: boolean
  readOnlyNote?: string
}) {
  const [state, action, pending] = useActionState<CoachSetupState, FormData>(uploadResumeAction, {})
  const err = state.errors ?? {}

  return (
    <div className="text-center">
      <Label className="text-base font-normal text-ink">Your resume (optional)</Label>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate">
        A PDF, just for us. It gives us useful context and never appears on your public
        profile.
      </p>

      <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center gap-3">
        {resumeUrl ? (
          <a
            href={resumeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink underline decoration-gold underline-offset-4"
          >
            View uploaded resume
          </a>
        ) : null}

        {canUpload ? (
          <form action={action} className="flex w-full flex-col items-center gap-3">
            <input
              type="file"
              name="resume"
              accept="application/pdf"
              required
              className="block w-full text-sm text-slate file:mr-3 file:rounded-md file:border file:border-line/25 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? 'Uploading…' : resumeUrl ? 'Replace resume' : 'Upload resume'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate">
            {readOnlyNote ?? 'Save your details first, then add a resume.'}
          </p>
        )}

        {err.resume?.length ? (
          <p role="alert" className="text-sm text-destructive">
            {err.resume[0]}
          </p>
        ) : null}
        {state.message ? <p className="text-sm text-slate">{state.message}</p> : null}
      </div>
    </div>
  )
}
