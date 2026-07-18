'use client'

import { useActionState, useState, useTransition } from 'react'
import { createInviteAction, type InviteState, resendInviteAction, revokeInviteAction } from './invite-actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export type PendingInvite = {
  id: string
  email: string
  fullName: string | null
  url: string
  createdAt: string
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          /* clipboard blocked — the link is visible to copy by hand */
        }
      }}
      className="text-slate underline decoration-gold underline-offset-4 hover:text-ink"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

export function InvitePanel({ pending }: { pending: PendingInvite[] }) {
  const [state, action, submitting] = useActionState<InviteState, FormData>(createInviteAction, {})
  const [, start] = useTransition()

  return (
    <Card className="border-line/20 p-6">
      <p className="label-mono">Invite a coach</p>
      <p className="mt-2 text-sm text-slate">
        For someone you&rsquo;ve already approved. They get an email with a setup link, and you get
        a copyable link here too.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label htmlFor="inv-name" className="label-mono">
            Name (optional)
          </label>
          <Input id="inv-name" name="fullName" placeholder="Jordan Lee" className="mt-1" />
        </div>
        <div className="min-w-52 flex-1">
          <label htmlFor="inv-email" className="label-mono">
            Email
          </label>
          <Input id="inv-email" name="email" type="email" placeholder="jordan@example.com" required className="mt-1" />
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send invite'}
        </Button>
      </form>

      {state.error ? <p role="alert" className="mt-3 text-sm text-destructive">{state.error}</p> : null}
      {state.success ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-ink">{state.success}</p>
          {state.url ? (
            <div className="flex flex-wrap items-center gap-3">
              <code className="overflow-x-auto rounded-md border border-line/20 bg-muted px-3 py-1.5 font-mono text-xs">
                {state.url}
              </code>
              <CopyButton url={state.url} />
            </div>
          ) : null}
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="mt-6 border-t border-line/15 pt-4">
          <p className="label-mono">Pending invites ({pending.length})</p>
          <ul className="mt-3 space-y-2">
            {pending.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-ink">{inv.fullName ?? inv.email}</span>
                {inv.fullName ? <span className="text-slate">{inv.email}</span> : null}
                <span className="text-xs text-slate">
                  sent {new Date(inv.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
                </span>
                <span className="ml-auto flex items-center gap-3 text-xs">
                  <CopyButton url={inv.url} />
                  <button
                    type="button"
                    onClick={() => {
                      const fd = new FormData()
                      fd.set('id', inv.id)
                      start(() => void resendInviteAction(fd))
                    }}
                    className="text-slate underline decoration-gold underline-offset-4 hover:text-ink"
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const fd = new FormData()
                      fd.set('id', inv.id)
                      start(() => void revokeInviteAction(fd))
                    }}
                    className="text-slate underline decoration-gold underline-offset-4 hover:text-destructive"
                  >
                    Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  )
}
