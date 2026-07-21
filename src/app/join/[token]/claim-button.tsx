'use client'

import { useState, useTransition } from 'react'
import { claimInvite } from './actions'
import { Button } from '@/components/ui/button'

export function ClaimButton({ token }: { token: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <div>
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const res = await claimInvite(token)
            if (res?.error) setError(res.error)
          })
        }
      >
        {pending ? 'Setting up…' : 'Continue as mentor'}
      </Button>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
