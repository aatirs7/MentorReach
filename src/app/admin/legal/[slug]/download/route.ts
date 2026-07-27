import { marked } from 'marked'
import { requireAdmin } from '@/lib/auth/guards'
import { COMPANY } from '@/lib/company'
import { getDocument, keyForSlug } from '@/lib/legal'

/**
 * Download a legal document as a self-contained, print-ready HTML file.
 *
 * HTML rather than a bundled PDF renderer: it opens in any browser and prints to PDF
 * cleanly with the browser's own "Save as PDF". Markdown → HTML is done with `marked`
 * (GFM, so the tables in the Privacy Policy render) rather than react-markdown, because
 * Next forbids react-dom/server in a route handler.
 *
 * Gated to admins: the /admin layout does not wrap route handlers, so the check has to be
 * here. The documents are public anyway (they render at /legal/[slug]); this endpoint just
 * hands a founder a filed copy.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin()

  const { slug } = await params
  const key = keyForSlug(slug)
  if (!key) return new Response('Not found', { status: 404 })

  const doc = getDocument(key)
  const effective = new Date(`${doc.effectiveDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

  const rendered = marked.parse(doc.content, { async: false, gfm: true })

  // Plain, black-on-white document styling — this is meant to be printed or filed, not to
  // match the marketing site. System fonts keep the file self-contained.
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${doc.title} — ${COMPANY.legalName}</title>
<style>
  :root { color-scheme: light; }
  body { max-width: 46rem; margin: 3rem auto; padding: 0 1.5rem; color: #111;
         font: 16px/1.65 -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }
  header { text-align: center; border-bottom: 1px solid #ddd; padding-bottom: 1.25rem; margin-bottom: 2rem; }
  h1 { font-size: 1.9rem; margin: 0 0 .4rem; }
  h2 { font-size: 1.25rem; margin: 2rem 0 .5rem; }
  h3 { font-size: 1.05rem; margin: 1.5rem 0 .4rem; }
  .meta { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em;
          text-transform: uppercase; color: #666; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ccc; padding: .5rem .6rem; text-align: left; font-size: .9rem; }
  blockquote { border-left: 3px solid #c89b3c; margin: 1rem 0; padding: .4rem 0 .4rem 1rem; color: #555; }
  a { color: #111; }
  @media print { body { margin: 0; max-width: none; } a { text-decoration: none; } }
</style>
</head>
<body>
<header>
  <p class="meta">${COMPANY.legalName}</p>
  <h1>${doc.title}</h1>
  <p class="meta">Version ${doc.version} · Effective ${effective}</p>
</header>
${rendered}
</body>
</html>`

  const filename = `MentorReach-${doc.title.replace(/[^a-z0-9]+/gi, '-')}-v${doc.version}.html`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
