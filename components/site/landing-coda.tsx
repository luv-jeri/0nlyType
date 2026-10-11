import { Share } from "@/components/site/landing"
import { Cta } from "@/components/site/landing-hero"

// The last call: start from zero.
export function Coda() {
  return (
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
  )
}
