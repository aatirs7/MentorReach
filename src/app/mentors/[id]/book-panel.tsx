'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { type BookState, slotsForOffering, startBooking } from './actions'
import { SlotChooser } from '@/components/slot-chooser'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { BookingGate } from '@/lib/auth/guards'
import { formatPrice } from '@/lib/mentor-schema'
import { ACK_LABEL, CHECKOUT_HEADING, policySentence } from '@/lib/policy-copy'

type Offering = { id: string; lengthMinutes: number; priceCents: number }

/**
 * Native scheduler booking: pick a length → pick an open slot → pay. The slot is held while
 * the student checks out. Times are shown in the viewer's own timezone.
 *
 * The §11 policy is stated HERE, before any money moves, and must be acknowledged. The
 * checkbox gates the button on the client for UX; the server action re-checks it.
 */
export function BookPanel({
  offerings,
  bookingEnabled,
  disabledReason,
  gate,
}: {
  offerings: Offering[]
  bookingEnabled: boolean
  disabledReason: string | null
  gate: BookingGate
}) {
  const [state, action, pending] = useActionState<BookState, FormData>(startBooking, {})
  const [selected, setSelected] = useState<string>(offerings[0]?.id ?? '')
  const [acked, setAcked] = useState(false)

  const blocked = !bookingEnabled || Boolean(disabledReason)

  const prices = (
    <div className="space-y-2">
      {offerings.map((o) => {
        const isSelected = selected === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => setSelected(o.id)}
            aria-pressed={isSelected}
            className={`flex w-full items-baseline justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
              isSelected ? 'border-gold bg-secondary' : 'border-line/25 hover:border-line/50'
            }`}
          >
            <span>{o.lengthMinutes} minutes</span>
            <span className="font-display text-lg">{formatPrice(o.priceCents)}</span>
          </button>
        )
      })}
    </div>
  )

  if (!gate.canBook) {
    return (
      <Card className="border-line/20 bg-raised p-6">
        <p className="label-mono">Book a session</p>
        <div className="mt-4">{prices}</div>
        <div className="mt-5 rounded-lg border border-line/20 bg-sand p-4">
          <p className="text-sm leading-relaxed text-slate">{gate.message}</p>
        </div>
        <Button asChild size="lg" className="mt-5 w-full">
          <Link href={gate.href}>{gate.cta}</Link>
        </Button>
        <p className="mt-3 text-center text-xs text-slate">
          Free cancellation up to 24 hours before your session.
        </p>
      </Card>
    )
  }

  return (
    <Card className="border-line/20 bg-raised p-6">
      <p className="label-mono">Book a session</p>

      <form action={action} className="mt-4">
        <input type="hidden" name="offeringId" value={selected} />
        <input type="hidden" name="policyAck" value={acked ? 'true' : ''} />

        {prices}

        <SlotPicker offeringId={selected} blocked={blocked} />

        <div className="mt-5 rounded-lg border border-line/20 bg-sand p-4 text-left">
          <p className="font-display text-base">{CHECKOUT_HEADING}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate">{policySentence()}</p>
          <div className="mt-3 flex items-start gap-2.5">
            <Checkbox
              id="policy-ack"
              checked={acked}
              onCheckedChange={(c) => setAcked(c === true)}
              disabled={blocked}
              className="mt-0.5"
            />
            <Label htmlFor="policy-ack" className="text-sm leading-snug font-normal text-ink">
              {ACK_LABEL}
            </Label>
          </div>
        </div>

        {disabledReason ? (
          <p className="mt-4 rounded-lg border border-line/20 bg-muted p-3 text-sm text-slate">
            {disabledReason}
          </p>
        ) : null}

        {state.error ? (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {state.error}
          </p>
        ) : null}

        <PayButton pending={pending} blocked={blocked} acked={acked} hasOffering={Boolean(selected)} />
      </form>
    </Card>
  )
}

/** Fetches open slots for the offering and lets the student pick a day + time. */
function SlotPicker({ offeringId, blocked }: { offeringId: string; blocked: boolean }) {
  const [slots, setSlots] = useState<string[]>([])
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!offeringId || blocked) return
    let cancelled = false
    slotsForOffering(offeringId).then((s) => {
      if (!cancelled) {
        setSlots(s)
        setLoadedFor(offeringId)
      }
    })
    return () => {
      cancelled = true
    }
  }, [offeringId, blocked])

  if (blocked) return null

  return (
    <div className="mt-5">
      <p className="label-mono">Pick a time</p>
      <p className="mt-1 text-xs text-slate">Shown in your timezone.</p>
      <SlotChooser slots={slots} loading={loadedFor !== offeringId} />
    </div>
  )
}

function PayButton({
  pending,
  blocked,
  acked,
  hasOffering,
}: {
  pending: boolean
  blocked: boolean
  acked: boolean
  hasOffering: boolean
}) {
  return (
    <>
      <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending || !hasOffering || blocked || !acked}>
        {pending ? 'Starting checkout…' : 'Pay and confirm'}
      </Button>
      <p className="mt-3 text-center text-xs text-slate">
        We hold your time while you check out, and email your Zoom link once you&rsquo;re booked.
      </p>
    </>
  )
}
