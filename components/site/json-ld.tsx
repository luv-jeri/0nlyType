/** Structured data for search engines: what the page is, in schema.org's words. `<` is escaped so no string can end the script. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}
