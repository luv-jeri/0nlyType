import { registryURL, sitePath } from "@/lib/site/config.mjs"
import NextLink from "next/link"

import "./landing.css"

import { AskFor, Share, TuneSentence } from "@/components/site/landing"
import { Cta } from "@/components/site/landing-hero"
import { Sec } from "@/components/site/landing-section"
import { REPO, ShareCall } from "@/components/site/landing-share"
import { LandingZero, type Movement } from "@/components/site/landing-zero"
import { catalog } from "@/lib/site/catalog"
import { entries } from "@/lib/site/entries"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Link } from "@/registry/0nlytype/ui/link"

// The home page, in order: two hands set in letters reach toward a zero made of every piece's name; the zero turns
// into the index; what the library leaves out; your own line set as the sea; one sentence that retunes the page;
// the line that installs it; the kit that teaches your AI; how to help build it; and a last call.

const movements: Movement[] = catalog.map((m) => ({
  num: m.num,
  name: m.name,
  pieces: m.items.map((e) => ({ name: e.meta.name, title: e.meta.title, summary: e.meta.summary })),
}))
const count = entries.length

// What the library refuses (INTENT.md, "What it refuses"), each struck as it scrolls into view.
const LEFT_OUT = ["Pictures", "boxes", "cards", "shadows", "gradients", "icons drawn as pictures"]

export default function Home() {
  return (
    <main id="content" className="page landing">
      <LandingZero movements={movements} count={count} />

      <Sec
        id="leaves"
        num="02"
        name="What it leaves out"
        className="sec-leaves"
        title="What it leaves out."
        note="Each of these does a job that type can do on its own. So each one goes, on purpose."
      >
        <p className="leaves-list">
          {LEFT_OUT.map((w, i) => (
            <span key={w} className="leaves-word">
              <s className="leaves-strike" style={{ "--i": i } as React.CSSProperties}>
                {w}
              </s>
              {i < LEFT_OUT.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
        <p className="leaves-kept">
          Kept: <span className="leaves-k">words</span>, <span className="leaves-k">space</span> and <span className="leaves-k">one accent</span>.
        </p>
        <p className="leaves-sign">An icon stays only as a sign made of its own word.</p>
      </Sec>

      <Sec
        id="sea"
        num="03"
        name="The sea"
        className="sec-sea"
        title="Your words, drawn as the sea."
        note="Type a line. We set it in your italic, over and over, until it draws the wave. Change one word and the whole sea is set again."
      >
        <p className="sea-later">After Hokusai, about 1831 · set in Bodoni Moda italic at 3 weights · no image file</p>
      </Sec>

      <Sec id="tune" num="04" name="Tune" title="One sentence retunes the page." note="Every italic word is a choice. Change one, and everything follows.">
        <TuneSentence />
      </Sec>

      <Sec
        id="install"
        num="05"
        name="Install"
        title="One line."
        note="0nlyType is a shadcn registry. Each piece arrives as source in your project, with its styles and the tokens it stands on."
      >
        <CommandLine runner command={`shadcn@latest add ${registryURL("button")}`} emphasis="button" className="install-line" />
        <p className="install-then">Nothing to update. Nothing to wrap. It&rsquo;s yours now.</p>
        <p className="install-links">
          <Link asChild>
            <NextLink href="/docs/install/">Set up a project</NextLink>
          </Link>
        </p>
      </Sec>

      <Sec id="ask" num="06" name="Ask" title="Or ask for it." note="The AI kit puts 0nlyType's rules and every contract in your project, so your assistant builds in type too.">
        <ol className="ask-steps">
          <li>
            <p className="ask-step">Add the kit.</p>
            <CommandLine runner command={`shadcn@latest add ${registryURL("ai")}`} emphasis="ai" className="install-line" />
          </li>
          <li>
            <p className="ask-step">Say what you want.</p>
            <AskFor />
          </li>
        </ol>
        <p className="install-links">
          <Link asChild>
            <NextLink href="/docs/build-with-ai/">Build with AI</NextLink>
          </Link>
        </p>
      </Sec>

      <Sec
        id="help"
        num="07"
        name="Help"
        title="Help build it."
        note="0nlyType is made by a small team, in the open. You don't need to write code to shape what it becomes."
      >
        <ul className="help-list">
          <li>
            <Cta href="/requests/">Request a component</Cta>
            <p className="help-note">The piece you need and can&rsquo;t find. The most asked for are built first.</p>
          </li>
          <li>
            <Cta href="/feedback/?kind=bug">Report a bug</Cta>
            <p className="help-note">Something that breaks, reads wrong, or moves when it shouldn&rsquo;t.</p>
          </li>
          <li>
            <Cta href={REPO}>Star it on GitHub</Cta>
            <p className="help-note">We need your support to keep working on this. A star is how we know it&rsquo;s wanted.</p>
          </li>
          <li>
            <ShareCall url="/" text="0nlyType: React components, set in type" note="Send it to someone who builds interfaces. It's how a small library gets found.">
              Share it
            </ShareCall>
          </li>
        </ul>
      </Sec>

      <section className="coda" aria-labelledby="coda-title">
        <h2 className="coda-title" id="coda-title">
          Start from zero.
        </h2>
        <div className="coda-actions">
          <Cta href="/docs/">Read the docs</Cta>
          <Share url="/" title="0nlyType: React components, set in type">
            Share 0nlyType
          </Share>
        </div>
        <p className="coda-licence">Free to use and change: MIT licensed, with typefaces under the SIL Open Font Licence.</p>
      </section>

      <footer className="landing-foot">
        <p>0nlyType is MIT licensed. Its typefaces are under the SIL Open Font Licence.</p>
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
