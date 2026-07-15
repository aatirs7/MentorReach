'use client'

import { useActionState, useState } from 'react'
import { type AdminState, setUserSuspension } from '../actions'
import { Button } from '@/components/ui/button'

/** Spec §12 — suspend / reinstate any non-admin account. */
export function SuspendActions({
  userId,
  name,
  suspended,
}: {
  userId: string
  name: string
  suspended: boolean
}) {
  const [state, action, pending] = useActionState<AdminState, FormData>(setUserSuspension, {})
  const [confirming, setConfirming] = useState(false)

  if (suspended) {
    return (
      <form action={action}>
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="suspend" value="false" />
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? 'Working…' : 'Reinstate'}
        </Button>
        <Feedback state={state} />
      </form>
    )
  }

  if (!confirming) {
    return (
      <>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
          Suspend
        </Button>
        <Feedback state={state} />
      </>
    )
  }

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="suspend" value="true" />
      <p className="mb-2 text-sm text-slate">
        Suspend {name}? They&rsquo;ll be signed out immediately and blocked from signing back in.
      </p>
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
