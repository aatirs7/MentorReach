import Link from 'next/link'
import { SignatureForm } from './signature-form'
import { LegalBody } from '@/app/legal/[slug]/legal-body'
import { Card } from '@/components/ui/card'
import { requireMentor } from '@/lib/auth/guards'
import { getDocument } from '@/lib/legal'
import { acceptancesFor } from '@/lib/legal-acceptance'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Mentor Agreement', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Sign the Mentor Agreement.
 *
 * The FULL text of both documents is rendered inline, on the page where the signature is
 * typed. Linking away and asking someone to tick a box for a document they were never
 * shown is the thing that makes an electronic signature worth arguing about later.
 */
export default async function MentorAgreementPage() {
  const { user } = await requireMentor()

  const agreement = getDocument('mentor_agreement')
  const handbook = getDocument('mentor_handbook')
  const signed = await acceptancesFor(user.id, ['mentor_agreement', 'mentor_handbook'])

  const current = signed.get('mentor_agreement')
  const isCurrentVersion = current?.documentVersion === agreement.version
  const needsResign = Boolean(current) && !isCurrentVersion

  return (
    <main className="mx-auto w-full max-w-[46rem] flex-1 px-6 py-12">
      <div className="text-center">
        <p className="label-mono">Required to publish</p>
        <h1 className="mt-3 text-4xl leading-tight">Mentor Agreement</h1>
        <p className="mx-auto mt-4 max-w-prose leading-relaxed text-slate">
          Read both documents below, then sign at the bottom. Your profile goes live once
          this is done and the rest of your checklist is complete.
        </p>
      </div>

      {/* Already signed, current version — show the record, not the form again. */}
      {isCurrentVersion && current ? (
        <Card className="mt-10 border-gold/40 bg-sand p-6 text-center">
          <p className="label-mono">Signed</p>
          <p className="mt-3 leading-relaxed">
            Signed on{' '}
            <span className="text-ink">
              {current.acceptedAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>{' '}
            as <span className="text-ink">{current.signatureName ?? 'unknown'}</span>, version{' '}
            {current.documentVersion}.
          </p>
          <p className="mt-3 font-mono text-[11px] break-all text-slate">
            {current.contentHash.slice(0, 32)}…
          </p>
          <p className="mt-4 text-sm text-slate">
            <Link
              href="/mentor"
              className="underline decoration-gold underline-offset-4 hover:text-ink"
            >
              Back to your mentoring
            </Link>
          </p>
        </Card>
      ) : null}

      {/*
       * A prior signature against an older version. The profile is unpublished until they
       * re-sign, so say that plainly rather than letting them discover it from a checklist
       * item silently reverting.
       */}
      {needsResign && current ? (
        <Card className="mt-10 border-destructive/40 bg-destructive/5 p-6">
          <p className="label-mono text-destructive">A new version needs signing</p>
          <p className="mt-3 leading-relaxed">
            You signed version {current.documentVersion} on{' '}
            {current.acceptedAt.toLocaleDateString('en-US', { dateStyle: 'long' })}. The
            Agreement has since been updated to version {agreement.version}, so your profile is
            hidden until you sign the new one. Nothing else about your profile has changed.
          </p>
        </Card>
      ) : null}

      <section className="mt-12">
        <div className="flex items-baseline justify-between border-b border-line/15 pb-2">
          <h2 className="text-2xl">{agreement.title}</h2>
          <span className="font-mono text-[10px] tracking-wide text-slate uppercase">
            v{agreement.version}
          </span>
        </div>
        {/* Scrollable rather than a wall: the full text is present, the page stays navigable. */}
        <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-line/15 bg-raised px-6 pb-6">
          <LegalBody markdown={agreement.content} />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between border-b border-line/15 pb-2">
          <h2 className="text-2xl">{handbook.title}</h2>
          <span className="font-mono text-[10px] tracking-wide text-slate uppercase">
            v{handbook.version}
          </span>
        </div>
        <div className="mt-2 max-h-[28rem] overflow-y-auto rounded-xl border border-line/15 bg-raised px-6 pb-6">
          <LegalBody markdown={handbook.content} />
        </div>
      </section>

      {!isCurrentVersion ? (
        <SignatureForm
          accountName={user.fullName}
          agreementVersion={agreement.version}
          handbookVersion={handbook.version}
        />
      ) : null}
    </main>
  )
}
