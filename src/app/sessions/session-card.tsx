'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  type ActionState,
  addSessionNote,
  cancelSessionAction,
  rescheduleSessionAction,
  rescheduleSlots,
} from './actions'
import { SlotChooser } from '@/components/slot-chooser'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/mentor-schema'
import { canCancel, isScheduled, refundEligibility, type SessionStatus, statusLabel, statusTone } from '@/lib/sessions'

export type SessionView = {
  id: string
  status: SessionStatus
  scheduledStart: string | null
  lengthMinutes: number
  amountCents: number
  payoutCents: number
  counterpartyName: string
  zoomJoinUrl: string | null
  notes: Array<{ id: string; body: string; createdAt: string }>
}

export function SessionCard({ session, viewerRole }: { session: SessionView; viewerRole: 'student' | 'mentor' }) {
  const [cancelState, cancelAction, canceling] = useActionState<ActionState, FormData>(
    cancelSessionAction,
    {},
  )
  const [noteState, noteAction, savingNote] = useActionState<ActionState, FormData>(
    addSessionNote,
    {},
  )
  const [confirming, setConfirming] = useState(false)
  const [writingNote, setWritingNote] = useState(false)

  const start = session.scheduledStart ? new Date(session.scheduledStart) : null

  // Show the student what canceling right now would actually do, using the same pure
  // function the server uses — so the warning can't drift from the policy.
  const eligibility = refundEligibility({ scheduledStart: start, now: new Date() })

  return (
    <Card className="border-line/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-mono">{session.lengthMinutes} min</p>
          <h3 className="mt-1.5 text-lg leading-snug">{session.counterpartyName}</h3>
          <p className="mt-1 text-sm text-slate">
            {start
              ? start.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
              : 'No time picked yet'}
          </p>
        </div>

        <div className="text-right">
          <Badge variant={statusTone(session.status)}>{statusLabel(session.status)}</Badge>
          <p className="mt-2 font-display text-lg">
            {formatPrice(viewerRole === 'mentor' ? session.payoutCents : session.amountCents)}
          </p>
          {viewerRole === 'mentor' ? <p className="text-xs text-slate">your payout</p> : null}
        </div>
      </div>

      {isScheduled(session.status) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {session.zoomJoinUrl ? (
            <Button asChild size="sm">
              <a href={session.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                Join (Zoom)
              </a>
            </Button>
          ) : null}
          <RescheduleControl sessionId={session.id} />
        </div>
      ) : null}

      {session.notes.length > 0 ? (
        <div className="mt-4 border-t border-line/15 pt-4">
          <p className="label-mono">Notes from your mentor</p>
          {session.notes.map((n) => (
            <p key={n.id} className="mt-2 text-sm leading-relaxed whitespace-pre-line text-ink/90">
              {n.body}
            </p>
          ))}
        </div>
      ) : null}

      {/* §12 — notes are the mentor's to write, and always available. */}
      {viewerRole === 'mentor' ? (
        writingNote ? (
          <form action={noteAction} className="mt-4 border-t border-line/15 pt-4">
            <input type="hidden" name="sessionId" value={session.id} />
            <Textarea
              name="body"
              rows={3}
              required
              placeholder="What you covered, what they should do next…"
              aria-label="Session note"
            />
            <div className="mt-2 flex gap-2">
              <Button type="submit" size="sm" disabled={savingNote}>
                {savingNote ? 'Saving…' : 'Save note'}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setWritingNote(false)}>
                Cancel
              </Button>
            </div>
            {noteState.error ? (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {noteState.error}
              </p>
            ) : null}
          </form>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="mt-3 px-0"
            onClick={() => setWritingNote(true)}
          >
            + Add a note for your student
          </Button>
        )
      ) : null}

      {noteState.success ? <p className="mt-2 text-sm text-slate">{noteState.success}</p> : null}

      {canCancel(session.status) ? (
        <div className="mt-4 border-t border-line/15 pt-4">
          {confirming ? (
            <form action={cancelAction}>
              <input type="hidden" name="sessionId" value={session.id} />
              <p className="text-sm text-ink">
                {eligibility.refundable
                  ? 'This is more than 24 hours away, so you’ll get a full refund.'
                  : 'This is inside the 24-hour window, so it is non-refundable.'}
              </p>
              <div className="mt-3 flex gap-2">
                <Button type="submit" size="sm" variant="destructive" disabled={canceling}>
                  {canceling ? 'Canceling…' : 'Yes, cancel it'}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Keep it
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-slate underline underline-offset-4 hover:text-ink"
            >
              Cancel this session
            </button>
          )}

          {cancelState.error ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {cancelState.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {cancelState.success ? <p className="mt-3 text-sm text-slate">{cancelState.success}</p> : null}
    </Card>
  )
}

/** Open a slot picker and move the session to a new time. */
function RescheduleControl({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false)
  const [slots, setSlots] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)
  const [state, action, pending] = useActionState<ActionState, FormData>(rescheduleSessionAction, {})

  useEffect(() => {
    if (!open) return
    let cancelled = false
    rescheduleSlots(sessionId).then((s) => {
      if (!cancelled) {
        setSlots(s)
        setLoaded(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, sessionId])

  if (state.success) {
    return <p className="w-full text-sm text-slate">{state.success}</p>
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Reschedule
      </Button>
    )
  }

  return (
    <form action={action} className="w-full rounded-lg border border-line/20 p-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <p className="label-mono">Pick a new time</p>
      <p className="mt-1 text-xs text-slate">Shown in your timezone.</p>
      <SlotChooser slots={slots} loading={!loaded} />
      {state.error ? <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Rescheduling…' : 'Confirm new time'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
