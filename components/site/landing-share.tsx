"use client"

import { siteURL } from "@/lib/site/config.mjs"
import * as React from "react"

import { REPO } from "@/lib/site/meta"
import { Link } from "@/registry/0nlytype/ui/link"

// Pass it on: one click copies the link and says so, and the places to send it open beside it, as words. Each
// place is a link to its own share page, in a new tab. Where the system has a share sheet (phones, mostly),
// "Other apps" opens it, and that reaches Instagram and the rest. Esc, a click elsewhere, or tabbing out
// closes it, and focus goes back where it was. The sea and "Help build it" set it on a line.

const places = (url: string, text: string) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(text)
  return [
    ["LinkedIn", `https://www.linkedin.com/sharing/share-offsite/?url=${u}`],
    ["X", `https://x.com/intent/post?text=${t}&url=${u}`],
    ["Bluesky", `https://bsky.app/intent/compose?text=${t}%20${u}`],
    ["Reddit", `https://www.reddit.com/submit?url=${u}&title=${t}`],
    ["Hacker News", `https://news.ycombinator.com/submitlink?u=${u}&t=${t}`],
    ["WhatsApp", `https://wa.me/?text=${t}%20${u}`],
  ] as const
}

/** The clipboard, else the old copy command; false when neither will. */
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {}
  const area = Object.assign(document.createElement("textarea"), { value: text, readOnly: true })
  area.style.cssText = "position:fixed;opacity:0"
  document.body.append(area)
  area.select()
  let done = false
  try { done = document.execCommand("copy") } catch {}
  area.remove()
  return done
}

const none = () => () => {}
const sheet = () => typeof navigator.share === "function"

/** Opening copies. Opened from a control, the panel takes focus, and gives it back on Esc, a click outside, or tabbing out. */
export function useShare(url: string) {
  const [open, setOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [panel, attach] = React.useState<HTMLDivElement | null>(null)
  const back = React.useRef<HTMLElement | null>(null)
  const owner = React.useRef<Element | null>(null) // the control that toggles it: a click there is its own
  const href = () => siteURL(url)

  const close = React.useCallback((restore = true) => {
    setOpen(false)
    const to = back.current
    back.current = null
    if (restore && to && to !== document.body) to.focus({ preventScroll: true })
  }, [])

  const show = React.useCallback(
    async (from?: Element | null, focus = true) => {
      owner.current = from ?? null
      back.current = (from ?? document.activeElement) as HTMLElement | null
      setCopied(false)
      setOpen(true)
      setCopied(await copy(siteURL(url)))
      if (focus) panel?.querySelector<HTMLElement>("a, button")?.focus({ preventScroll: true })
    },
    [url, panel],
  )

  React.useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    const down = (e: PointerEvent) => {
      const t = e.target as Element
      if (panel?.contains(t) || owner.current?.contains(t)) return
      // A click on something that takes focus keeps it; a click on nothing gives it back.
      close(!t.closest("a, button, input, textarea, select, [tabindex]"))
    }
    const out = (e: FocusEvent) => { if (!panel?.contains(e.relatedTarget as Node)) close(false) }
    const el = panel
    document.addEventListener("keydown", key)
    document.addEventListener("pointerdown", down, true)
    el?.addEventListener("focusout", out)
    return () => {
      document.removeEventListener("keydown", key)
      document.removeEventListener("pointerdown", down, true)
      el?.removeEventListener("focusout", out)
    }
  }, [open, close, panel])

  return { open, copied, show, close, attach, href }
}

type PlacesProps = {
  share: ReturnType<typeof useShare>
  text: string
  /** Ask for a star too, where the page doesn't already. */
  star?: boolean
  className?: string
  style?: React.CSSProperties
}

/** The places, as words: the one thing said first, then where to send it. */
export function SharePlaces({ share, text, star = true, className, style }: PlacesProps) {
  const can = React.useSyncExternalStore(none, sheet, () => false)
  const { open, copied, attach, href } = share
  const url = open ? href() : ""
  return (
    <div
      ref={attach}
      className={className ? `places ${className}` : "places"}
      style={style}
      role="group"
      aria-label="Share"
      data-open={open || undefined}
      inert={!open}
    >
      <p className="places-said">
        {copied ? "Link copied" : "Pass it on"}
        <span className="places-stop">.</span>
      </p>
      <ul className="places-list">
        {places(url, text).map(([name, href]) => (
          <li key={name}>
            <Link href={href} external variant="quiet">
              {name}
            </Link>
          </li>
        ))}
        <li>
          <Link href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`} variant="quiet">
            Email
          </Link>
        </li>
        {can ? (
          <li>
            <button type="button" className="places-more" onClick={() => navigator.share({ title: "0nlyType", text, url }).catch(() => {})}>
              Other apps
            </button>
          </li>
        ) : null}
      </ul>
      {star ? (
        <p className="places-star">
          <Link href={REPO} external>
            Star on GitHub
          </Link>
        </p>
      ) : null}
      <span className="ot-sr" aria-live="polite">
        {open && copied ? "Link copied. Or choose where to send it." : ""}
      </span>
    </div>
  )
}

// ponytail: the call's letters repeat landing-hero's Cta markup, which is a link; lift it into one when a third wants it.
/** Help build it: a call like its neighbours; the places take the note's place on the line, so nothing moves. */
export function ShareCall({ url, text, children, label, note }: { url: string; text: string; children: string; label?: string; note: string }) {
  const share = useShare(url)
  return (
    <>
      <button
        type="button"
        className="cta share-call"
        aria-expanded={share.open}
        onClick={(e) => (share.open ? share.close() : share.show(e.currentTarget))}
      >
        <span className="ot-sr">{label ?? children}</span>
        <span className="cta-word" aria-hidden="true" data-text={children}>
          <span className="cta-letters">
            {Array.from(children).map((c, i) => (
              <span key={i} style={{ "--i": i } as React.CSSProperties}>
                {c}
              </span>
            ))}
          </span>
        </span>
        <span className="cta-stop" aria-hidden="true">
          .
        </span>
      </button>
      <div className="share-swap" data-open={share.open || undefined}>
        <p className="help-note">{note}</p>
        <SharePlaces share={share} text={text} star={false} className="places-line" />
      </div>
    </>
  )
}
