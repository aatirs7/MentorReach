'use server'

import { revalidatePath } from 'next/cache'
import { requireMentor } from '@/lib/auth/guards'
import { recordAcceptance, validateSignature } from '@/lib/legal-acceptance'

export type SignState = { error?: string }

/**
 * Record a mentor's signature on the Agreement and the Handbook.
 *
 * THIS ACTION IS THE CHECKLIST ITEM. The publish gate reads `legal_acceptances`, so
 * completion cannot be faked by client state — there is no separate flag to flip, and a
 * replayed or hand-crafted POST still has to land a row here to count.
 *
 * The version and content hash are read from the document registry inside
 * recordAcceptance(), never taken from the form, so a client cannot claim to have signed
 * a version it never saw.
 */
export async function signAgreement(_prev: SignState, formData: FormData): Promise<SignState> {
  const { user } = await requireMentor()

  const agreed = formData.get('agreed') === 'on'
  const signature = String(formData.get('signature') ?? '')

  if (!agreed) {
    return { error: 'Please tick the box to confirm you have read both documents.' }
  }

  const check = validateSignature(signature)
  if (!check.ok) return { error: check.error }

  /**
   * Both documents in one action, because they are presented and agreed to together. Two
   * rows rather than one: they version independently, so a Handbook update should not
   * silently invalidate an Agreement signature or vice versa.
   */
  await recordAcceptance({
    userId: user.id,
    keys: ['mentor_agreement', 'mentor_handbook'],
    method: 'typed_signature',
    signatureName: signature,
  })

  revalidatePath('/mentor')
  revalidatePath('/mentor/agreement')
  return {}
}
