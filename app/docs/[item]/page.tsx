import { readFileSync } from "node:fs"
import type { Metadata } from "next"
import type { CSSProperties } from "react"
import NextLink from "next/link"
import { notFound } from "next/navigation"

import { Meta } from "@/registry/0nlytype/ui/meta"
import { Prose } from "@/registry/0nlytype/ui/typography"
import { Source } from "@/registry/0nlytype/ui/source"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Steps, Step, StepTitle } from "@/registry/0nlytype/ui/steps"
import { Scrollbar } from "@/registry/0nlytype/ui/scrollbar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/registry/0nlytype/ui/tabs"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/registry/0nlytype/ui/table"
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/registry/0nlytype/ui/pagination"
import { Link } from "@/registry/0nlytype/ui/link"
import { entries } from "@/lib/site/entries"
import { movementName, ordered, UNDER } from "@/lib/site/catalog"
import { contractFor, motionRows, moveRows } from "@/lib/site/design-md"
import { exampleSource, installCommand } from "@/lib/site/example-source"
import { rewriteImports } from "@/scripts/lib/items.mjs"
import { ItemExample } from "./examples"
import { DemoExample } from "./demo-example"
import { SignCatalogue } from "@/components/site/sign-catalogue"

type Params = { params: Promise<{ item: string }> }

export function generateStaticParams() {
  return entries.map((e) => ({ item: e.meta.name }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { item } = await params
  const entry = entries.find((e) => e.meta.name === item)
  return entry ? { title: entry.meta.title, description: entry.meta.summary } : {}
}

/** The files `shadcn add` writes for this item, read from its published payload. */
function payload(name: string) {
  const json = JSON.parse(readFileSync(`public/r/${name}.json`, "utf8")) as {
    dependencies?: string[]
    files: { path: string; type: string; target?: string; content: string }[]
  }
  return {
    npm: json.dependencies ?? [],
    files: json.files.map((f) => ({
      target: f.target ?? f.path.replace("registry/0nlytype/ui/", "components/ui/").replace("registry/0nlytype/lib/", "lib/0nlytype/"),
      content: f.path.endsWith(".css") ? f.content : rewriteImports(f.content),
    })),
  }
}

// Two tables share the Craft section, so each carries its name where it can be seen, not only in its caption.
function Rows({ id, title, table }: { id: string; title: string; table: { header: string[]; rows: string[][] } }) {
  return (
    <div className="doc-block">
      <h3 id={id} className="doc-sub">{title}</h3>
      <div className="doc-table" role="region" aria-labelledby={id} tabIndex={0}>
        <Scrollbar axis="x" />
        <Table>
          <TableCaption>{title}</TableCaption>
          <TableHeader>
            <TableRow>
              {table.header.map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.map((r, i) => (
              <TableRow key={i}>
                {r.map((c, j) => (
                  <TableCell key={j} primary={j === 0} dangerouslySetInnerHTML={{ __html: c }} />
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default async function ItemPage({ params }: Params) {
  const { item } = await params
  const entry = entries.find((e) => e.meta.name === item)
  if (!entry) notFound()
  const { meta } = entry
  const at = ordered.findIndex((e) => e.meta.name === item)
  const prev = ordered[at - 1]?.meta
  const next = ordered[at + 1]?.meta
  const contract = contractFor(meta.contract, meta.name)
  const moves = moveRows(meta.name)
  const motion = motionRows(meta.name)
  const { npm, files } = payload(meta.name)
  const siblings = entry.siblings as string[]
  const exampleDependencies = entry.exampleDependencies.map((name) => entries.find((e) => e.meta.name === name)!.meta)

  return (
    <article>
      <header className="doc-head">
        <Meta>
          <span>
            {meta.movement} {movementName(meta.movement)}
          </span>
          <span>{UNDER[meta.underneath]}</span>
          <span className="ot-label">{meta.contract}</span>
        </Meta>
        <h1 className="doc-title" style={{ "--doc-title-chars": Math.max(...meta.title.split(/\s+/).map((word) => word.length)) } as CSSProperties}>{meta.title}</h1>
        <p className="doc-summary">{meta.summary}</p>
        <Link asChild className="ot-report-item-link"><NextLink href={`/feedback/?kind=bug&item=${encodeURIComponent(meta.name)}`} prefetch={false}>Report an issue with {meta.title}</NextLink></Link>
      </header>

      <section className="doc-section" id="example" data-rail="Example" aria-labelledby="example-h">
        <h2 id="example-h" className="ot-sr">
          Example
        </h2>
        <DemoExample item={item}><ItemExample item={item} /></DemoExample>
        {entry.hasStates ? (
          <div className="spec-states" inert aria-label="States, pinned">
            <ItemExample item={item} states />
          </div>
        ) : null}
      </section>

      {item === "sign" ? (
        <section className="doc-section" id="signs" data-rail="Signs" aria-labelledby="signs-h">
          <h2 id="signs-h">Signs</h2>
          <p className="doc-lead">Each sign is its own item in each variant: install only the ones you use, and each brings this primitive along. Point at one to hear it; press it for its install line.</p>
          <SignCatalogue />
        </section>
      ) : null}

      <section className="doc-section doc-install" id="install" data-rail="Install" aria-labelledby="install-h">
        <h2 id="install-h">Install</h2>
        <Tabs defaultValue="cli">
          <TabsList aria-label="How to install">
            <TabsTrigger value="cli">Command</TabsTrigger>
            <TabsTrigger value="manual">By hand</TabsTrigger>
          </TabsList>
          <TabsContent value="cli">
            <p>Run it in a project that has the shadcn CLI set up. It brings {new Intl.ListFormat("en").format(["the 0nlyType base", ...siblings])} along.</p>
            <CommandLine runner command={installCommand(meta.name)} emphasis={meta.name} />
          </TabsContent>
          <TabsContent value="manual">
            <Steps>
              <Step>
                <StepTitle>Install the base</StepTitle>
                <p>
                  The tokens, fonts and base styles every item stands on. See{" "}
                  <Link asChild>
                    <NextLink href="/docs/install/">Install</NextLink>
                  </Link>
                  .
                </p>
              </Step>
              {npm.length ? (
                <Step>
                  <StepTitle>Add the packages</StepTitle>
                  <CommandLine command={`npm install ${npm.join(" ")}`} />
                </Step>
              ) : null}
              {siblings.length ? (
                <Step>
                  <StepTitle>Add the items it uses</StepTitle>
                  <p>
                    {siblings.map((s, i) => (
                      <span key={s}>
                        {i ? ", " : ""}
                        <Link asChild>
                          <NextLink href={`/docs/${s}/`}>{s}</NextLink>
                        </Link>
                      </span>
                    ))}
                  </p>
                </Step>
              ) : null}
              {files.map((f) => (
                <Step key={f.target}>
                  <StepTitle>Copy {f.target}</StepTitle>
                  {f.target.endsWith(".css") ? (
                    <p>
                      Then import it from your global stylesheet: <code>@import &quot;../{f.target}&quot;;</code> (Tailwind resolves it relative to app/globals.css, not through the @/ alias)
                    </p>
                  ) : null}
                  <Source title={f.target} code={f.content} />
                </Step>
              ))}
            </Steps>
          </TabsContent>
        </Tabs>
      </section>

      <section className="doc-section" id="usage" data-rail="Usage" aria-labelledby="usage-h">
        <h2 id="usage-h">Usage</h2>
        {exampleDependencies.length ? (
          <div className="doc-example-dependencies">
            <p>
              This example also uses {exampleDependencies.map((dependency, i) => (
                <span key={dependency.name}>
                  {i ? i === exampleDependencies.length - 1 ? " and " : ", " : ""}
                  <Link asChild><NextLink href={`/docs/${dependency.name}/`}>{dependency.title}</NextLink></Link>
                </span>
              ))}.
            </p>
            <CommandLine command={entry.exampleInstallCommand} />
          </div>
        ) : null}
        <Source title={`${meta.name}-example.tsx`} code={exampleSource(meta.name)} />
      </section>

      {contract ? (
        <section className="doc-section" id="contract" data-rail="Contract" aria-labelledby="contract-h">
          <h2 id="contract-h">Contract</h2>
          <Prose dangerouslySetInnerHTML={{ __html: contract }} />
        </section>
      ) : null}

      {meta.props.length ? (
        <section className="doc-section" id="props" data-rail="Props" aria-labelledby="props-h">
          <h2 id="props-h">Props</h2>
          <div className="doc-table doc-props" role="region" aria-label={`Props of ${meta.title}`} tabIndex={0}>
            <Scrollbar axis="x" />
            <Table>
              <TableCaption>Props of {meta.title}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Prop</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>What it does</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meta.props.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell primary>
                      <code>{p.name}</code>
                    </TableCell>
                    <TableCell>
                      <code>{p.type}</code>
                    </TableCell>
                    <TableCell>{p.default ? <code>{p.default}</code> : null}</TableCell>
                    <TableCell>{p.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      {moves.rows.length || motion.rows.length ? (
        <section className="doc-section" id="craft" data-rail="Craft" aria-labelledby="craft-h">
          <h2 id="craft-h">Craft</h2>
          <div className="doc-steps">
            {moves.rows.length ? <Rows id="craft-move" title="Where its move comes from" table={moves} /> : null}
            {motion.rows.length ? <Rows id="craft-motion" title="How it moves" table={motion} /> : null}
          </div>
        </section>
      ) : null}

      <Pagination className="doc-foot" aria-label="Items">
        <PaginationContent>
          <PaginationItem>
            {prev ? (
              <PaginationPrevious asChild>
                <NextLink href={`/docs/${prev.name}/`} rel="prev" aria-label={`Previous: ${prev.title}`}>
                  {prev.title}
                </NextLink>
              </PaginationPrevious>
            ) : (
              <PaginationPrevious />
            )}
          </PaginationItem>
          <PaginationItem>
            {next ? (
              <PaginationNext asChild>
                <NextLink href={`/docs/${next.name}/`} rel="next" aria-label={`Next: ${next.title}`}>
                  {next.title}
                </NextLink>
              </PaginationNext>
            ) : (
              <PaginationNext />
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>

    </article>
  )
}
