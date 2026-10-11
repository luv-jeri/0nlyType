import { sitePath, siteURL } from "@/lib/site/config.mjs"
import type { Metadata } from "next"

import "./landing.css"
import "./landing-leaves.css"
import "./landing-sea.css"
import "./landing-install.css"
import "./landing-ask.css"
import "./landing-help.css"
import "./landing-coda.css"

import { Ask } from "@/components/site/landing-ask"
import { Coda } from "@/components/site/landing-coda"
import { Help } from "@/components/site/landing-help"
import { Install } from "@/components/site/landing-install"
import { Leaves } from "@/components/site/landing-leaves"
import { Sea } from "@/components/site/landing-sea"
import { LandingZero, type Movement } from "@/components/site/landing-zero"
import { JsonLd } from "@/components/site/json-ld"
import { pageMeta, REPO, SITE_DESCRIPTION, SITE_NAME, STUDIO } from "@/lib/site/meta"
import { catalog } from "@/lib/site/catalog"
import { entries } from "@/lib/site/entries"
import { Link } from "@/registry/0nlytype/ui/link"

// The home page, in order: two hands set in letters reach toward a zero made of every piece's name; the zero turns
// into the index; what the library leaves out; one sentence that retunes the page;
// the line that installs it; the kit that teaches your AI; how to help build it; and a last call.

const movements: Movement[] = catalog.map((m) => ({
  num: m.num,
  name: m.name,
  pieces: m.items.map((e) => ({ name: e.meta.name, title: e.meta.title, summary: e.meta.summary })),
}))
const count = entries.length

// The home page names the library and what it is in the title, where a search result shows it.
export const metadata: Metadata = pageMeta({ absolute: `${SITE_NAME} · A React component library set entirely in type`, description: SITE_DESCRIPTION })

// For search: the site, and the code it publishes.
const data = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: SITE_NAME, url: siteURL("/"), description: SITE_DESCRIPTION, inLanguage: "en", publisher: STUDIO },
    {
      "@type": "SoftwareSourceCode",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: siteURL("/"),
      codeRepository: REPO,
      programmingLanguage: ["TypeScript", "CSS"],
      runtimePlatform: "React",
      license: "https://opensource.org/licenses/MIT",
      author: STUDIO,
    },
  ],
}

export default function Home() {
  return (
    <main id="content" className="page landing">
      <JsonLd data={data} />
      <LandingZero movements={movements} count={count} />

      <Leaves />
      <Sea />
      <Install />
      <Ask />
      <Help />
      <Coda />

      <footer className="landing-foot">
        <p>0nlyType is made by The Directors, in the open.</p>
        <p>
          <Link href={sitePath("/requests/")}>Request a component</Link>. <Link href={sitePath("/feedback/?kind=bug")}>Report a bug</Link>.{" "}
          <Link href={REPO} external>
            Star it on GitHub
          </Link>
        </p>
        <p>
          <Link href={sitePath("/specimen/")}>The specimen</Link>.
        </p>
      </footer>
    </main>
  )
}
