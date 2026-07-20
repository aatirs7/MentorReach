/**
 * Renders a schema.org graph as a JSON-LD script tag.
 *
 * WHY `JSON.stringify` AND NOT A TEMPLATE STRING: this content ends up inside a <script>
 * element, where the parser ends the script at the first literal `</script>` regardless of
 * quoting. A bio containing that text — or `<!--` — would break out of the tag and inject
 * markup. Escaping `<` covers all three cases, and structured data is frequently built
 * from user-supplied text (coach bios, titles), so the risk is real rather than theoretical.
 *
 * dangerouslySetInnerHTML is required: React would otherwise HTML-escape the JSON and
 * every crawler would fail to parse it.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')

  return (
    <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: json }} />
  )
}
