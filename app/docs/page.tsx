import type { Metadata } from "next"
import NextLink from "next/link"

import { pageMeta } from "@/lib/site/meta"
import { Rows, Row, RowKind, RowMeta, RowTitle } from "@/registry/0nlytype/ui/rows"
import { Link } from "@/registry/0nlytype/ui/link"
import { catalog, UNDER } from "@/lib/site/catalog"

export const metadata: Metadata = pageMeta({
  title: "Index",
  description: "Every 0nlyType component, grouped by movement, with a line on what each one does.",
})

export default function DocsIndexPage() {
  const count = catalog.reduce((n, m) => n + m.items.length, 0)
  return (
    <>
      <header className="doc-head">
        <h1 className="doc-title">Index</h1>
        <p className="doc-summary">{count} items in {catalog.length} movements. Each one is a typographic idea standing on a native element or a Radix primitive.</p>
        <p><Link asChild><NextLink href="/docs/build-with-ai/" prefetch={false}>Build with AI</NextLink></Link></p>
      </header>
      {catalog.map((m) => (
        <section key={m.num} className="doc-section" aria-labelledby={`m-${m.num}`}>
          <h2 id={`m-${m.num}`} data-rail={m.name} data-rail-num={m.num}>
            {m.num} {m.name}
          </h2>
          <Rows>
            {m.items.map((e) => (
              <Row key={e.meta.name} asChild>
                <NextLink href={`/docs/${e.meta.name}/`} prefetch={false}>
                  <RowTitle>{e.meta.title}</RowTitle>
                  <RowKind>{UNDER[e.meta.underneath]}</RowKind>
                  <RowMeta>{e.meta.contract}</RowMeta>
                </NextLink>
              </Row>
            ))}
          </Rows>
        </section>
      ))}
    </>
  )
}
