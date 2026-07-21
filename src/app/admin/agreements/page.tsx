import { desc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { ConsoleHeader } from '@/components/console-shell'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { db } from '@/db'
import { legalAcceptances, users } from '@/db/schema'
import { requireAdmin } from '@/lib/auth/guards'
import { LEGAL_KEYS, getDocument, isLegalKey } from '@/lib/legal'
import { NO_INDEX } from '@/lib/seo'

export const metadata = { title: 'Agreements', ...NO_INDEX }
export const dynamic = 'force-dynamic'

/**
 * Every acceptance ever recorded — the register.
 *
 * Read-only, and there is no delete. The table is append-only by design, so an admin
 * screen that could remove a row would defeat the point of keeping one.
 */
export default async function AdminAgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string; stale?: string }>
}) {
  await requireAdmin()

  const { doc, stale } = await searchParams
  const filterKey = isLegalKey(doc) ? doc : null
  const staleOnly = stale === '1'

  const rows = await db
    .select({
      acceptance: legalAcceptances,
      userName: users.fullName,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(legalAcceptances)
    .innerJoin(users, eq(users.id, legalAcceptances.userId))
    .where(filterKey ? eq(legalAcceptances.documentKey, filterKey) : undefined)
    .orderBy(desc(legalAcceptances.acceptedAt))

  /** Current version per document, so a stale signature is visible at a glance. */
  const currentVersion = new Map(LEGAL_KEYS.map((k) => [k, getDocument(k).version]))

  const visible = staleOnly
    ? rows.filter((r) => currentVersion.get(r.acceptance.documentKey as never) !== r.acceptance.documentVersion)
    : rows

  const staleCount = rows.filter(
    (r) => currentVersion.get(r.acceptance.documentKey as never) !== r.acceptance.documentVersion,
  ).length

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <ConsoleHeader
        title="Agreements"
        description="Every acceptance and signature on record. Append-only — nothing here can be edited or removed."
      />

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <FilterChip href="/admin/agreements" active={!filterKey && !staleOnly}>
          All ({rows.length})
        </FilterChip>
        {LEGAL_KEYS.map((k) => (
          <FilterChip key={k} href={`/admin/agreements?doc=${k}`} active={filterKey === k}>
            {getDocument(k).title}
          </FilterChip>
        ))}
        {staleCount > 0 ? (
          <FilterChip href="/admin/agreements?stale=1" active={staleOnly} tone="warn">
            Out of date ({staleCount})
          </FilterChip>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate">
          {rows.length === 0
            ? 'Nothing recorded yet. Acceptances appear here as people sign up and mentors sign.'
            : 'Nothing matches that filter.'}
        </p>
      ) : (
        <Card className="mt-8 border-line/20 bg-raised p-0">
          {/* Its own scroll container, so a wide table never scrolls the page sideways. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <thead>
                <tr>
                  {['Person', 'Document', 'Version', 'Method', 'Signed name', 'When', 'IP'].map(
                    (h) => (
                      <th
                        key={h}
                        className="border-b border-line/25 px-4 py-3 text-left font-mono text-[10px] tracking-widest text-slate uppercase whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map(({ acceptance: a, userName, userEmail, userRole }) => {
                  const current = currentVersion.get(a.documentKey as never)
                  const isStale = current !== undefined && current !== a.documentVersion

                  return (
                    <tr key={a.id} className="border-b border-line/12 last:border-0">
                      <td className="px-4 py-3 align-top">
                        <div className="leading-snug">{userName ?? 'Unnamed'}</div>
                        <div className="text-xs text-slate">{userEmail}</div>
                        <div className="mt-1 font-mono text-[10px] tracking-wide text-slate uppercase">
                          {userRole}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isLegalKey(a.documentKey) ? getDocument(a.documentKey).title : a.documentKey}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        <span className="font-mono text-xs tabular-nums">{a.documentVersion}</span>
                        {isStale ? (
                          <Badge variant="destructive" className="ml-2">
                            out of date
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="font-mono text-[10px] tracking-wide text-slate uppercase">
                          {a.method === 'typed_signature' ? 'signature' : 'checkbox'}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {a.signatureName ? (
                          <span className="font-display">{a.signatureName}</span>
                        ) : (
                          <span className="text-slate">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-slate">
                        {a.acceptedAt.toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-mono text-[11px] text-slate">{a.ipAddress ?? '—'}</div>
                        {/*
                         * The hash is the evidence of WHAT was agreed to. Truncated for
                         * scanning; the title attribute carries the full value for anyone
                         * who needs to compare it.
                         */}
                        <div
                          className="mt-1 font-mono text-[10px] text-slate/70"
                          title={`sha256: ${a.contentHash}`}
                        >
                          {a.contentHash.slice(0, 12)}…
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-slate">
        A row marked <span className="text-ink">out of date</span> was signed against an earlier
        version. For the Mentor Agreement that also means the mentor is unpublished until they
        sign again — see{' '}
        <Link
          href="/admin/mentors"
          className="underline decoration-gold underline-offset-4 hover:text-ink"
        >
          Mentors
        </Link>
        .
      </p>
    </main>
  )
}

function FilterChip({
  href,
  active,
  tone,
  children,
}: {
  href: string
  active: boolean
  tone?: 'warn'
  children: React.ReactNode
}) {
  const base = 'rounded-full px-3 py-1 text-sm transition-colors'
  const style = active
    ? 'bg-ink text-paper'
    : tone === 'warn'
      ? 'border border-destructive/40 text-destructive hover:bg-destructive/5'
      : 'text-slate hover:text-ink'

  return (
    <Link href={href} className={`${base} ${style}`}>
      {children}
    </Link>
  )
}
