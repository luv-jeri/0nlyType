import { registryURL } from "@/lib/site/config.mjs"
import NextLink from "next/link"

import { CopyCommand } from "@/components/site/landing"
import { Cta } from "@/components/site/landing-hero"
import { Overture, OvertureScript } from "@/components/site/landing-overture"
import { Wordmark } from "@/components/site/wordmark"

// The hero and 01, the pieces: two hands set in real letters reach toward a zero made of every piece's name.

export type Piece = { name: string; title: string; summary: string }
export type Movement = { num: string; name: string; pieces: Piece[] }

export function LandingZero({ movements, count }: { movements: Movement[]; count: number }) {
  return (
    <section className="zero" aria-labelledby="hero-title">
      <OvertureScript />
      <div className="hero-band">
        <Wordmark id="hero-title" className="hero-mark" />
        <div className="hero-says">
          <p className="hero-zero">
            <span className="hero-zero-k">0 =</span> pictures, boxes and shadows. Everything else is type, even the hands.
          </p>
          <span className="hero-cta">
            <Cta href="/docs/">Read the docs</Cta>
          </span>
        </div>
        <div className="hero-install">
          <p className="hero-count">{count} React components, set in words, for the shadcn CLI.</p>
          <CopyCommand command={`npx shadcn@latest add ${registryURL("button")}`} emphasis="button" />
        </div>
      </div>
      <Overture />
      <div className="pieces-part">
        <h2 className="pieces-title" id="pieces" data-rail="The pieces" data-rail-num="01">
          {count} pieces. Turn to one.
        </h2>
        <nav aria-label="Every piece">
          <ol className="pieces-list">
            {movements.flatMap((m) =>
              m.pieces.map((p) => (
                <li key={p.name}>
                  <NextLink href={`/docs/${p.name}/`} prefetch={false}>
                    {p.title}
                  </NextLink>
                </li>
              )),
            )}
          </ol>
        </nav>
      </div>
    </section>
  )
}
