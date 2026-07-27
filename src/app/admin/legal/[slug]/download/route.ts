import { requireAdmin } from '@/lib/auth/guards'
import { getDocument, keyForSlug } from '@/lib/legal'
import { renderLegalPdf } from '@/lib/legal-pdf'

// react-pdf needs the Node runtime (it is not edge-compatible).
export const runtime = 'nodejs'

/**
 * Download a legal document as a formatted PDF.
 *
 * The PDF is built with @react-pdf/renderer from the same markdown the public /legal pages
 * render (see src/lib/legal-pdf.tsx) — pure JS, so it works on Vercel without a headless
 * browser. Gated to admins here because the /admin layout does not wrap route handlers; the
 * documents are public anyway, this just hands a founder a filed copy.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin()

  const { slug } = await params
  const key = keyForSlug(slug)
  if (!key) return new Response('Not found', { status: 404 })

  const doc = getDocument(key)
  const pdf = await renderLegalPdf(doc)
  const filename = `MentorReach-${doc.title.replace(/[^a-z0-9]+/gi, '-')}-v${doc.version}.pdf`

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
