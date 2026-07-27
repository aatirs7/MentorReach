import { createElement, type ReactNode } from 'react'
import { Document, Link, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer'
import { marked, type Token, type Tokens } from 'marked'
import { COMPANY } from './company'
import type { LegalDocument } from './legal'

/**
 * Render a legal document to a real PDF, formatted for filing or sending to a lawyer/bank.
 *
 * @react-pdf/renderer rather than a headless-Chrome route: it is pure JS, so it runs on
 * Vercel's serverless functions without shipping a ~50MB chromium binary. The tradeoff is
 * there is no HTML/CSS engine, so markdown is walked token-by-token (via marked's lexer)
 * and each construct is mapped to a react-pdf primitive. The legal docs use a constrained
 * subset — headings, paragraphs, bullet lists, one table, blockquotes, bold, links — which
 * is exactly what is handled below.
 *
 * Built-in Helvetica/Times faces only (no font files to bundle or load at runtime).
 */
const styles = StyleSheet.create({
  page: { paddingTop: 64, paddingBottom: 64, paddingHorizontal: 64, fontFamily: 'Times-Roman', fontSize: 10.5, lineHeight: 1.5, color: '#1a1a1a' },
  header: { marginBottom: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#cccccc', textAlign: 'center' },
  brand: { fontFamily: 'Helvetica', fontSize: 8, letterSpacing: 1.5, color: '#666666', textTransform: 'uppercase' },
  title: { fontFamily: 'Times-Bold', fontSize: 20, marginTop: 6, marginBottom: 6 },
  meta: { fontFamily: 'Helvetica', fontSize: 8, letterSpacing: 1, color: '#666666', textTransform: 'uppercase' },
  h2: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginTop: 16, marginBottom: 6 },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 11, marginTop: 10, marginBottom: 4 },
  para: { marginBottom: 8, textAlign: 'justify' },
  listItem: { flexDirection: 'row', marginBottom: 4, paddingLeft: 8 },
  bullet: { width: 14, fontFamily: 'Times-Roman' },
  listText: { flex: 1 },
  bold: { fontFamily: 'Times-Bold' },
  italic: { fontFamily: 'Times-Italic' },
  link: { color: '#0e1826', textDecoration: 'underline' },
  quote: { marginBottom: 10, marginTop: 2, paddingVertical: 6, paddingHorizontal: 10, borderLeftWidth: 2, borderLeftColor: '#c89b3c', backgroundColor: '#f6f1e5' },
  quoteText: { fontFamily: 'Helvetica-Bold', fontSize: 9, letterSpacing: 1, color: '#8a6524' },
  hr: { borderBottomWidth: 1, borderBottomColor: '#e0e0e0', marginVertical: 10 },
  table: { marginVertical: 8, borderWidth: 1, borderColor: '#cccccc' },
  tr: { flexDirection: 'row' },
  th: { flex: 1, padding: 5, fontFamily: 'Helvetica-Bold', fontSize: 9, backgroundColor: '#f0f0f0', borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#cccccc' },
  td: { flex: 1, padding: 5, fontSize: 9, borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#eeeeee' },
})

let inlineKey = 0

/** Inline tokens (bold, italic, links, plain text) rendered as nested <Text>. */
function renderInline(tokens: Token[] | undefined, text: string): ReactNode {
  if (!tokens || tokens.length === 0) return text
  return tokens.map((t) => {
    const key = `i${inlineKey++}`
    switch (t.type) {
      case 'strong':
        return createElement(Text, { key, style: styles.bold }, renderInline((t as Tokens.Strong).tokens, (t as Tokens.Strong).text))
      case 'em':
        return createElement(Text, { key, style: styles.italic }, renderInline((t as Tokens.Em).tokens, (t as Tokens.Em).text))
      case 'codespan':
        return createElement(Text, { key, style: { fontFamily: 'Courier' } }, (t as Tokens.Codespan).text)
      case 'link':
        return createElement(Link, { key, src: (t as Tokens.Link).href, style: styles.link }, renderInline((t as Tokens.Link).tokens, (t as Tokens.Link).text))
      case 'br':
        return createElement(Text, { key }, '\n')
      default:
        return createElement(Text, { key }, (t as Tokens.Text).text ?? '')
    }
  })
}

/** Block-level tokens → react-pdf elements. */
function renderBlocks(tokens: Token[]): ReactNode[] {
  const out: ReactNode[] = []
  tokens.forEach((tok, i) => {
    const key = `b${i}`
    switch (tok.type) {
      case 'heading': {
        const h = tok as Tokens.Heading
        const style = h.depth <= 1 ? styles.title : h.depth === 2 ? styles.h2 : styles.h3
        out.push(createElement(Text, { key, style }, renderInline(h.tokens, h.text)))
        break
      }
      case 'paragraph': {
        const p = tok as Tokens.Paragraph
        out.push(createElement(Text, { key, style: styles.para }, renderInline(p.tokens, p.text)))
        break
      }
      case 'list': {
        const list = tok as Tokens.List
        list.items.forEach((item, j) => {
          out.push(
            createElement(
              View,
              { key: `${key}-${j}`, style: styles.listItem, wrap: false },
              createElement(Text, { style: styles.bullet }, list.ordered ? `${(Number(list.start) || 1) + j}.` : '•'),
              createElement(Text, { style: styles.listText }, renderInline(item.tokens?.flatMap((t) => (t as Tokens.Text).tokens ?? [t]), item.text)),
            ),
          )
        })
        break
      }
      case 'blockquote': {
        const bq = tok as Tokens.Blockquote
        out.push(
          createElement(
            View,
            { key, style: styles.quote },
            createElement(Text, { style: styles.quoteText }, renderInline((bq.tokens?.[0] as Tokens.Paragraph)?.tokens, bq.text)),
          ),
        )
        break
      }
      case 'table': {
        const table = tok as Tokens.Table
        const rows: ReactNode[] = []
        rows.push(
          createElement(
            View,
            { key: 'h', style: styles.tr, wrap: false },
            ...table.header.map((cell, c) => createElement(Text, { key: `h${c}`, style: styles.th }, renderInline(cell.tokens, cell.text))),
          ),
        )
        table.rows.forEach((row, r) =>
          rows.push(
            createElement(
              View,
              { key: `r${r}`, style: styles.tr, wrap: false },
              ...row.map((cell, c) => createElement(Text, { key: `r${r}c${c}`, style: styles.td }, renderInline(cell.tokens, cell.text))),
            ),
          ),
        )
        out.push(createElement(View, { key, style: styles.table }, ...rows))
        break
      }
      case 'hr':
        out.push(createElement(View, { key, style: styles.hr }))
        break
      default:
        break // 'space' and anything unexpected: skip
    }
  })
  return out
}

export async function renderLegalPdf(doc: LegalDocument): Promise<Buffer> {
  inlineKey = 0
  const effective = new Date(`${doc.effectiveDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })

  const tokens = marked.lexer(doc.content)

  const element = createElement(
    Document,
    { title: `${doc.title} — ${COMPANY.legalName}`, author: COMPANY.legalName },
    createElement(
      Page,
      { size: 'LETTER', style: styles.page },
      createElement(
        View,
        { style: styles.header, fixed: true },
        createElement(Text, { style: styles.brand }, COMPANY.legalName),
        createElement(Text, { style: styles.title }, doc.title),
        createElement(Text, { style: styles.meta }, `Version ${doc.version}  ·  Effective ${effective}`),
      ),
      ...renderBlocks(tokens),
    ),
  )

  return renderToBuffer(element)
}
