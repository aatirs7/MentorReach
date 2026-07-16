'use client'

import { useActionState } from 'react'
import { type CoachActionState, connectCalendarAction } from './actions'
import { Button } from '@/components/ui/button'

export function ConnectCalendarButton() {
  const [state, action, pending] = useActionState<CoachActionState, FormData>(
    () => connectCalendarAction(),
    {},
  )

  return (
    <form action={action} className="inline">
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? 'Connecting…' : 'Connect calendar'}
      </Button>
      {state.error ? (
        <span role="alert" className="ml-3 text-xs text-destructive">
          {state.error}
        </span>
      ) : null}
      {state.success ? <span className="ml-3 text-xs text-slate">{state.success}</span> : null}
    </form>
  )
}
