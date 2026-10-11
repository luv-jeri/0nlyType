import { siteURL } from "@/lib/site/config.mjs"
import type { Metadata } from "next"
import NextLink from "next/link"

import { pageMeta } from "@/lib/site/meta"
import { Source } from "@/registry/0nlytype/ui/source"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Steps, Step, StepTitle } from "@/registry/0nlytype/ui/steps"
import { Link } from "@/registry/0nlytype/ui/link"
import { Prose } from "@/registry/0nlytype/ui/typography"

export const metadata: Metadata = pageMeta({
  title: "Install",
  description: "Add the 0nlyType base, then any item, with the shadcn CLI.",
})

const BASE = siteURL("/r")

const HTML = `<html
  lang="en"
  data-mode="day"          // or "nocturne"
  data-scheme="cotton"     // blueprint, statue, silence, riso
  data-key="ultramarine"   // viridian, ember, violet: overrides the scheme's accent
  data-pair="parma"        // press, paris, salon: add fonts-<pair> first
>`

export default function Install() {
  return (
    <>
      <header className="doc-head">
        <h1 className="doc-title">Install</h1>
        <p className="doc-summary">0nlyType is a shadcn registry. You own the code it writes: every item lands in your project as a component and a small stylesheet.</p>
      </header>
      <section className="doc-section" aria-labelledby="steps-h">
        <h2 id="steps-h" data-rail="Four steps">Four steps</h2>
        <Steps>
          <Step>
            <StepTitle>Start from a Next app with Tailwind v4</StepTitle>
            <p>Set up the shadcn CLI once, if the project doesn&apos;t have a components.json yet.</p>
            <CommandLine runner command="shadcn@latest init" />
          </Step>
          <Step>
            <StepTitle>Add the base</StepTitle>
            <p>
              The tokens, the default font pair, the reset and the base pieces (link, key, fraction, meta, corners). It also points shadcn&apos;s own colour names at 0nlyType&apos;s, so
              a stock globals.css renders 0nlyType.
            </p>
            <CommandLine runner command={`shadcn@latest add ${BASE}/0nlytype.json`} emphasis="0nlytype" />
          </Step>
          <Step>
            <StepTitle>Add an item</StepTitle>
            <p>
              Each item brings the base and the siblings it needs. Its stylesheet is imported into your global CSS for you, by a path relative to app/globals.css. With a src/ layout,
              shadcn puts the files in src/styles/0nlytype/, so the same path works from src/app/globals.css.
            </p>
            <CommandLine runner command={`shadcn@latest add ${BASE}/button.json ${BASE}/checkbox.json`} />
          </Step>
          <Step>
            <StepTitle>Set the four switches, if you want them</StepTitle>
            <p>
              All optional, all on <code>&lt;html&gt;</code>. Without them you get Day, cotton, ultramarine and the parma pair.
            </p>
            <Source title="app/layout.tsx" code={HTML} noCopy />
          </Step>
        </Steps>
      </section>
      <section className="doc-section" aria-labelledby="notes-h">
        <h2 id="notes-h" data-rail="Worth knowing">Worth knowing</h2>
        <Prose>
          <ul>
            <li>
              Fonts are self-hosted and ship with their OFL notices. The other pairs are separate items: <code>fonts-press</code>, <code>fonts-paris</code>,{" "}
              <code>fonts-salon</code>.
            </li>
            <li>
              Every item&apos;s CSS sits in <code>@layer components</code> and reads only <code>--ot-*</code> tokens, so your Tailwind utilities still win where you use them.
            </li>
            <li>Reduced motion is handled in the tokens: every tempo becomes 1ms. Nothing else to set.</li>
            <li>
              Right-to-left pages work with <code>dir=&quot;rtl&quot;</code> on any ancestor.
            </li>
          </ul>
          <p>
            Then read the{" "}
            <Link asChild>
              <NextLink href="/docs/principles/">principles</NextLink>
            </Link>{" "}
            before building with it.
          </p>
        </Prose>
      </section>
    </>
  )
}
