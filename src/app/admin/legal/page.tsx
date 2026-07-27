import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { ConsoleHeader } from '@/components/console-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { legalAcceptances } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { COMPANY } from '@/lib/company'
import { allDocuments } from '@/lib/legal'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Legal', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * The legal document library and the company entity record.
 *
 * Distinct from /admin/agreements, which is the ACCEPTANCE REGISTER (who agreed to what,
 * when). This is the library: the documents themselves, their current version and content
 * hash, whether any bracketed placeholder is still unresolved, and the entity facts that
 * fill their contact sections. Read-only — the documents are versioned markdown in the
 * repo, edited there and locked by src/lib/legal.test.ts, not from a form.
 */
export default async function AdminLegalPage() {
  await requireAdmin()

  const docs = allDocuments()

  // Current-version acceptance counts, one grouped query rather than one per document.
  const counts = await db
    .select({
      key: legalAcceptances.documentKey,
      version: legalAcceptances.documentVersion,
      n: sql<number>`COUNT(*)::int`,
    })
    .from(legalAcceptances)
    .groupBy(legalAcceptances.documentKey, legalAcceptances.documentVersion)

  const acceptedNow = (key: string, version: string) =>
    counts.find((c) => c.key === key && c.version === version)?.n ?? 0

  /**
   * The EIN is not in the repo (this is a public repository). Set COMPANY_EIN in
   * .env.local and Vercel to surface it here; otherwise the row says so plainly rather
   * than showing a blank that reads as "we don't have one".
   */
  const ein = process.env.COMPANY_EIN?.trim() || null

  const anyPlaceholders = docs.some((d) => d.placeholders.length > 0)

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <ConsoleHeader
        title="Legal"
        description="The company record and the current legal documents. Acceptances live under Agreements."
        action={
          <Link
            href="/admin/agreements"
            className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
          >
            Go to the acceptance register
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
          <Field label="Federal tax classification" value={COMPANY.taxClassification} />
          <Field label="Registered address" value={COMPANY.registeredAddress} />
          <Field label="Support email" value={COMPANY.supportEmail} />
          <Field
            label="EIN"
            value={ein ?? 'Not shown — set COMPANY_EIN to display'}
            mono={Boolean(ein)}
            muted={!ein}
          />
        </dl>

        <p className="mt-5 border-t border-line/15 pt-4 text-xs leading-relaxed text-slate">
          Public-record details from the Virginia SCC filing. The EIN is kept out of this
          (public) repository — it lives in the CP&#8209;575 notice and, if set, the COMPANY_EIN
          environment variable.
        </p>
      </Card>

      {/* ------------------------------------------------------------- documents */}
      <div className="mt-12 flex items-baseline justify-between border-b border-line/15 pb-2">
        <h2 className="font-display text-2xl">Documents</h2>
        <span className="font-mono text-xs text-slate">{docs.length}</span>
      </div>

      {anyPlaceholders ? (
        <p className="mt-4 rounded-lg border-l-2 border-[#8a6524] bg-sand px-4 py-3 text-sm text-ink">
          One or more documents still contain an unresolved <code className="font-mono text-xs">[BRACKET]</code>{' '}
          placeholder. A document with placeholders is not ready to publish or to have anyone sign.
        </p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {docs.map((doc) => {
          const accepted = acceptedNow(doc.key, doc.version)
          const open = doc.placeholders.length > 0
          return (
            <li key={doc.key}>
              <Card className="border-line/20 bg-raised p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-lg">{doc.title}</h3>
                    <span className="font-mono text-xs text-slate">v{doc.version}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {open ? (
                      <Badge className="border-[#8a6524] bg-transparent text-[#8a6524]">
                        {doc.placeholders.length} placeholder{doc.placeholders.length === 1 ? '' : 's'}
                      </Badge>
                    ) : (
                      <Badge className="border-[#3f6b4f] bg-transparent text-[#3f6b4f]">Filled</Badge>
                    )}
                    <Link
                      href={`/legal/${doc.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-slate underline decoration-gold underline-offset-4 hover:text-ink"
                    >
                      Read →
                    </Link>
                  </div>
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs text-slate">
                  <span>
                    Effective <span className="text-ink">{doc.effectiveDate}</span>
                  </span>
                  <span>
                    Current acceptances <span className="text-ink tabular-nums">{accepted}</span>
                  </span>
                  <span className="font-mono" title={doc.contentHash}>
                    sha256 <span className="text-ink">{doc.contentHash.slice(0, 12)}…</span>
                  </span>
                </dl>

                {open ? (
                  <p className="mt-3 text-xs text-slate">
                    Unresolved: <span className="text-ink">{doc.placeholders.join('  ·  ')}</span>
                  </p>
                ) : null}
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
