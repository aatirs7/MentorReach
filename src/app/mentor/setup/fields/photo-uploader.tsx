'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { type MentorSetupState, uploadHeadshotAction } from '../actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

/**
 * Headshot upload — its own form/action so a large image can't take a text save down with
 * it. Shared by the one-page /mentor/setup and the guided /mentor/onboarding photo step.
 *
 * `canUpload` is false before the profile row exists (the action requires it) and while an
 * admin is previewing read-only; in both cases we show a note instead of the file input.
 */
export function PhotoUploader({
  headshotUrl,
  canUpload,
  readOnlyNote,
}: {
  headshotUrl: string | null
  canUpload: boolean
  readOnlyNote?: string
}) {
  const [state, action, pending] = useActionState<MentorSetupState, FormData>(uploadHeadshotAction, {})
  const err = state.errors ?? {}

  return (
    <div className="text-center">
      <Label className="text-base font-normal text-ink">Your photo</Label>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate">
        A real photo of you. Students book a person, so this is required before your profile
        goes live.
      </p>

      <div className="mx-auto mt-4 flex w-full max-w-md flex-col items-center gap-4">
        {headshotUrl ? (
          <Image
            src={headshotUrl}
            alt="Your current headshot"
            width={112}
            height={112}
            className="size-28 rounded-full border border-line/20 object-cover"
          />
        ) : (
          <div className="flex size-28 items-center justify-center rounded-full border border-dashed border-line/40 text-sm text-slate">
            No photo
          </div>
        )}

        {canUpload ? (
          <form action={action} className="flex w-full flex-col items-center gap-3">
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              required
              className="block w-full text-sm text-slate file:mr-3 file:rounded-md file:border file:border-line/25 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:text-ink"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? 'Uploading…' : headshotUrl ? 'Replace photo' : 'Upload photo'}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-slate">
            {readOnlyNote ?? 'Save your details first, then add a photo.'}
          </p>
        )}

        {err.photo?.length ? (
          <p role="alert" className="text-sm text-destructive">
            {err.photo[0]}
          </p>
        ) : null}
        {state.message ? <p className="text-sm text-slate">{state.message}</p> : null}
      </div>
    </div>
  )
}
