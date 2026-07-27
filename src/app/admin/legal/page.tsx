import Link from 'next/link'
import { ConsoleHeader } from '@/components/console-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { requireAdmin } from '@/lib/auth/guards'
import { COMPANY } from '@/lib/company'
import { allDocuments, type LegalKey } from '@/lib/legal'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Legal', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/** One plain-English line per document, so the list explains itself. */
const DESCRIPTIONS: Record<LegalKey, string> = {
  terms: 'The agreement every user accepts to use MentorReach.',
  privacy: 'What information we collect and how we handle it.',
  refunds: 'When a session can be cancelled and refunded.',
  mentor_agreement: 'The contract every mentor signs before going live.',
  mentor_handbook: 'The conduct standards mentors agree to follow.',
}

/**
 * The company record and the legal documents, for the two founders.
 *
 * Founder-facing on purpose: no content hashes, no "placeholder" jargon. A document is
 * either ready, waiting on a lawyer, or waiting on a specific decision — said in words.
 * View opens the document in the browser; Download saves a print-ready copy.
 */
export default async function AdminLegalPage() {
  await requireAdmin()

  const docs = allDocuments()
  const ein = process.env.COMPANY_EIN?.trim() || null

  // The one genuinely-open item across the whole set: how disputes are handled. It lives
  // in the two documents that contain a "[CHOOSE ONE, WITH COUNSEL:]" marker.
  const awaitingDecision = docs.some((d) => d.content.includes('[CHOOSE ONE'))

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <ConsoleHeader
        title="Legal"
        description="Your company record and the legal documents behind the platform."
        action={
          <Link
            href="/admin/agreements"
            className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            See who has signed what
          </Link>
        }
      />

      {/* -------------------------------------------------------- company record */}
      <Card className="mt-10 border-line/20 bg-raised p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl">{COMPANY.legalName}</h2>
          <span className="label-mono">d/b/a {COMPANY.dba}</span>
        </div>

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Field label="State of formation" value={COMPANY.state} />
          <Field label={`${COMPANY.filingAgency} ID`} value={COMPANY.sccId} mono />
          <Field
            label="Formed"
            value={new Date(`${COMPANY.formedOn}T00:00:00`).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
          <Field label="EIN" value={ein ?? 'Set COMPANY_EIN to display'} mono={Boolean(ein)} muted={!ein} />
          <Field label="Federal tax classification" value={COMPANY.taxClassification} />
          <Field label="Support email" value={COMPANY.supportEmail} />
          <Field label="Registered address" value={COMPANY.registeredAddress} />
        </dl>
      </Card>

      {/* ------------------------------------------------------------- documents */}
      <div className="mt-12 flex items-baseline justify-between border-b border-line/15 pb-2">
        <h2 className="font-display text-2xl">Documents</h2>
        <span className="font-mono text-xs text-slate">{docs.length}</span>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate">
        Your company details are filled into all of these. They are still marked{' '}
        <span className="text-ink">draft</span> because a lawyer should review them before you publish
        them or have any mentor sign.
        {awaitingDecision ? (
          <>
            {' '}
            One decision is also still open — <span className="text-ink">how disputes are handled</span>{' '}
            (court vs. arbitration) — in the Terms and the Mentor Agreement.
          </>
        ) : null}
      </p>

      <ul className="mt-6 space-y-3">
        {docs.map((doc) => {
          const needsDecision = doc.content.includes('[CHOOSE ONE')
          const isDraft = doc.content.includes('DRAFT.')
          return (
            <li key={doc.key}>
              <Card className="border-line/20 bg-raised p-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-lg">{doc.title}</h3>
                      <span className="font-mono text-xs text-slate">v{doc.version}</span>
                      {needsDecision ? (
                        <Badge className="border-[#8a6524] bg-transparent text-[#8a6524]">
                          Needs a legal decision
                        </Badge>
                      ) : isDraft ? (
                        <Badge className="border-slate/40 bg-transparent text-slate">
                          Draft — attorney review
                        </Badge>
                      ) : (
                        <Badge className="border-[#3f6b4f] bg-transparent text-[#3f6b4f]">Ready</Badge>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-slate">{DESCRIPTIONS[doc.key]}</p>

                    {needsDecision ? (
                      <div className="mt-3 rounded-lg border-l-2 border-[#8a6524] bg-sand px-4 py-3">
                        <p className="font-display text-sm text-ink">Decision needed: how disputes are handled</p>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate">
                          Choose one, with your lawyer: <span className="text-ink">Option A</span> — disputes
                          go to the courts in Loudoun County, Virginia; or <span className="text-ink">Option B</span>{' '}
                          — binding arbitration with a class-action waiver. The Terms and the Mentor Agreement
                          must use the same choice.
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={`/legal/${doc.slug}`} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                    <Button asChild size="sm">
                      {/* Native download — the route sets Content-Disposition: attachment. */}
                      <a href={`/admin/legal/${doc.slug}/download`}>Download</a>
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </main>
  )
}

function Field({
  label,
  value,
  mono,
  muted,
}: {
  label: string
  value: string
  mono?: boolean
  muted?: boolean
}) {
  return (
    <div>
      <dt className="label-mono">{label}</dt>
      <dd className={`mt-1 text-sm ${muted ? 'text-slate italic' : 'text-ink'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
