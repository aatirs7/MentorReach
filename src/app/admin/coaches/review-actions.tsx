'use client'

import { useActionState, useState } from 'react'
import { type AdminState, setCoachStatus } from '../actions'
import { Button } from '@/components/ui/button'

/** Suspend / reinstate a coach — the only admin lever now that approval is gone. */
export function StatusActions({ profileId, suspended }: { profileId: string; suspended: boolean }) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setCoachStatus, {})
  const [confirming, setConfirming] = useState(false)

  if (suspended) {
    return (
      <form action={action} className="mt-4 border-t border-line/15 pt-4">
        <input type="hidden" name="profileId" value={profileId} />
        <input type="hidden" name="suspend" value="false" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? 'Working…' : 'Reinstate'}
        </Button>
        <Feedback state={state} />
      </form>
    )
  }

  return (
    <div className="mt-4 border-t border-line/15 pt-4">
      {confirming ? (
        <form action={action}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="suspend" value="true" />
          <p className="mb-2 text-sm text-slate">Take this coach offline?</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              {pending ? 'Suspending…' : 'Yes, suspend'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
          <Feedback state={state} />
        </form>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Suspend
          </Button>
          <Feedback state={state} />
        </>
      )}
    </div>
  )
}

function Feedback({ state }: { state: AdminState }) {
  if (state.success) return <p className="mt-2 text-sm text-slate">{state.success}</p>
  if (state.error)
    return (
      <p role="alert" className="mt-2 text-sm text-destructive">
        {state.error}
      </p>
    )
  return null
}
