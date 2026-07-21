'use client'

import { useActionState, useState } from 'react'
import { signAgreement, type SignState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signatureLooksDifferent } from '@/lib/legal-acceptance-shared'

/**
 * The signature block.
 *
 * Everything here is a convenience: the real validation runs in the server action, which
 * is the same thing that satisfies the publish checklist. This exists so someone finds
 * out about a problem before submitting, not so the browser decides anything.
 */
export function SignatureForm({
  accountName,
  agreementVersion,
  handbookVersion,
}: {
  accountName: string | null
  agreementVersion: string
  handbookVersion: string
}) {
  const [state, action, pending] = useActionState<SignState, FormData>(signAgreement, {})
  const [signature, setSignature] = useState('')
  const [agreed, setAgreed] = useState(false)

  const today = new Date().toLocaleDateString('en-US', { dateStyle: 'long' })

  /**
   * A WARNING, not a block — people sign with middle names, maiden names, or the legal
   * name behind a nickname. Refusing those would stop a legitimate mentor onboarding over
   * a formatting difference, so the server does not enforce it either.
   */
  const nameDiffers = signature.trim().length > 3 && signatureLooksDifferent(signature, accountName)

  return (
    <form action={action} className="mt-12 rounded-2xl border border-line/25 bg-sand p-6 sm:p-8">
      <h2 className="text-2xl">Sign</h2>
      <p className="mt-3 leading-relaxed text-slate">
        Signing records your name, the date and time, the document versions, and a
        fingerprint of the exact text above. That record is what makes this a signature.
      </p>

      <label className="mt-6 flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name="agreed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-gold"
        />
        <span className="text-sm leading-relaxed">
          I have read and agree to the Mentor Agreement (v{agreementVersion}) and the Mentor
          Handbook (v{handbookVersion}).
        </span>
      </label>

      <div className="mt-6">
        <label htmlFor="signature" className="label-mono block">
          Type your full legal name to sign
        </label>
        <Input
          id="signature"
          name="signature"
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="e.g. Alexandra J. Whitfield"
          autoComplete="name"
          className="mt-2 font-display text-lg"
          aria-describedby="signature-meta"
        />
        <p id="signature-meta" className="mt-2 font-mono text-[11px] tracking-wide text-slate">
          {today} · Agreement v{agreementVersion} · Handbook v{handbookVersion}
        </p>

        {nameDiffers ? (
          <p className="mt-3 rounded-lg border border-gold/40 bg-raised p-3 text-sm leading-relaxed text-slate">
            That doesn&rsquo;t look like the name on your account
            {accountName ? ` (${accountName})` : ''}. If it&rsquo;s your legal name, carry on
            &mdash; middle names and maiden names are fine.
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending} className="mt-6 w-full">
        {pending ? 'Recording your signature…' : 'Sign and continue'}
      </Button>
    </form>
  )
}
