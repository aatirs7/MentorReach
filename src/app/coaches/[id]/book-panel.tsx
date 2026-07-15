'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { type BookState, startBooking } from './actions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { BookingGate } from '@/lib/auth/guards'
import { formatPrice } from '@/lib/coach-schema'
import { ACK_LABEL, CHECKOUT_HEADING, policySentence } from '@/lib/policy-copy'

type Offering = { id: string; lengthMinutes: number; priceCents: number }

/**
 * Spec §8 — pick a length, then pay. Payment precedes scheduling, so this panel's job
 * ends at the Stripe redirect; the Calendly step happens after the webhook confirms.
 *
 * The §11 policy is stated HERE, before any money moves, and must be acknowledged. The
 * checkbox gates the pay button on the client for the UX, and the server action
 * re-checks it — a disabled button is not enforcement.
 *
 * NOTE on the deadline: the policy sentence carries no concrete timestamp at this point,
 * and that is not an omission. Because §8 puts payment before scheduling, there is no
 * session start time yet, so no deadline exists to compute. Printing a guess would be
 * worse than stating the rule: it would be a written promise about a time we don't know.
 * The concrete deadline appears in the confirmation email, once a time has been picked.
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

  /**
   * Not signed in, or survey unfinished. Show the prices anyway — the point of making
   * this page public is that a stranger can weigh it up — and ask for exactly the one
   * thing that's missing, rather than dumping them at a sign-in wall with no context.
   */
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

        {/* §11 — stated before payment, and acknowledged. */}
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

        <Button
          type="submit"
          size="lg"
          className="mt-5 w-full"
          disabled={pending || !selected || blocked || !acked}
        >
          {pending ? 'Starting checkout…' : 'Pay and pick a time'}
        </Button>

        <p className="mt-3 text-center text-xs text-slate">
          You&rsquo;ll choose a time right after payment.
        </p>
      </form>
    </Card>
  )
}
