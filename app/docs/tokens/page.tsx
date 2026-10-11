import { readFileSync } from "node:fs"
import * as React from "react"
import type { Metadata } from "next"

import { CopyButton } from "@/registry/0nlytype/ui/source"
import { Waterfall } from "@/registry/0nlytype/ui/waterfall"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/registry/0nlytype/ui/table"

export const metadata: Metadata = {
  title: "Tokens",
  description: "Every --ot- token and its Day value. Copy one to use it.",
}

/** Text that names tokens, set so it can wrap at a hyphen of a token's name and nowhere else inside it: --ot- and the first word stay whole, then each later word may start a line. */
function Wrappable({ text }: { text: string }) {
  return (
    <>
      {text.split(/(--[\w-]+)/).map((part, i) => {
        if (i % 2 === 0) return part
        const words = part.slice(2).split("-")
        const first = words.slice(0, 2).join("-")
        const rest = words.slice(2)
        return (
          <React.Fragment key={i}>
            <span className="doc-token-ref">--{first}</span>
            {rest.map((word, j) => <React.Fragment key={j}>-<wbr />{word}</React.Fragment>)}
          </React.Fragment>
        )
      })}
    </>
  )
}

/** The first :root block of tokens.css, grouped by its own comments. */
function groups() {
  const css = readFileSync("registry/0nlytype/styles/tokens.css", "utf8")
  const root = css.slice(css.indexOf(":root"), css.indexOf("\n}", css.indexOf(":root")))
  const out: { title: string; tokens: { name: string; value: string }[] }[] = []
  for (const line of root.split("\n")) {
    const heading = line.match(/^\s*\/\* ([^:*]+?)[:.*]/)
    if (heading) out.push({ title: heading[1].trim(), tokens: [] })
    for (const [, name, value] of line.matchAll(/(--ot-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      if (!out.length) out.push({ title: "Tokens", tokens: [] })
      out[out.length - 1].tokens.push({ name, value: value.trim() })
    }
  }
  return out.filter((g) => g.tokens.length)
}

export default function Tokens() {
  return (
    <>
      <header className="doc-head">
        <h1 className="doc-title">Tokens</h1>
        <p className="doc-summary">Every item reads only these. The values shown are Day; the scheme, key, pair and Nocturne switches change them in place.</p>
      </header>
      <section className="doc-section" aria-labelledby="t-heard">
        <h2 id="t-heard" data-rail="Dynamics">The dynamics, heard</h2>
        <Waterfall>Every size steps by a fourth, like a scale, from the overture down to the quietest caption on the page.</Waterfall>
      </section>
      {groups().map((g) => (
        <section key={g.title} className="doc-section" aria-labelledby={`t-${g.title}`}>
          <h2 id={`t-${g.title}`} data-rail={g.title}>{g.title}</h2>
          <div className="doc-table doc-tokens" role="region" aria-label={`${g.title} tokens`} tabIndex={0}>
            <Table>
              <TableCaption>{g.title} tokens</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Day value</TableHead>
                  <TableHead>
                    <span className="ot-sr">Copy</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.tokens.map((t) => (
                  <TableRow key={t.name}>
                    <TableCell primary>
                      <code><Wrappable text={t.name} /></code>
                    </TableCell>
                    <TableCell>
                      <code><Wrappable text={t.value} /></code>
                    </TableCell>
                    <TableCell>
                      <CopyButton text={`var(${t.name})`} aria-label={`Copy var(${t.name})`} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}
    </>
  )
}
