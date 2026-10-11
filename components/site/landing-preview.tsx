"use client"

import * as React from "react"

import { ItemExample } from "@/app/docs/[item]/examples"
import { PreviewStyles } from "@/components/site/registry-styles"
import { Still } from "@/components/site/state"
import { afterOverture } from "@/components/site/landing-overture"

// The piece being read, shown as itself: its docs example, live, in the room the sheet gives it, laid out at the
// room's width in one column. Most examples are several demos one under another, so the preview shows the first demo
// (with any heading or lead line above it) and as many more as fit whole at their own size. A first demo too tall for
// the room is scaled down, never up, but not below the size its words still read at: past that it is cut instead, to
// its fields, rows or lines that fit whole. The parts left out keep their place, unseen and clipped off, since several
// pieces lay themselves out by their own width and would lay out again for nothing if taken out of the flow. The
// preview waits for the reading to settle on a piece, so turning through the rings does not load every piece on the
// way: the last piece fades as the reading moves, and the next arrives once its own sidecars have loaded (the
// landing's sheet does not carry every piece's). It is a picture of the piece, not a second control: it takes no focus
// and no press, so the keys stay with the rings, and the name and description beside it say what it is to a screen
// reader.
const SETTLE = 240
// A part shorter than this is a heading or a lead line: it shows with the demo under it, never alone.
const LABEL = 32
// The smallest a demo is drawn. Below it the words stop reading, so the demo is drawn at this size instead and cut to
// the whole parts of it that fit: its first fields, rows or lines, never half of one.
const FLOOR = 0.66
// What is kept whole or left out whole when a demo is cut: a picture, a control or a run of text.
const WHOLE = new Set(["svg", "img", "canvas", "video", "picture", "p", "h1", "h2", "h3", "h4", "h5", "h6", "button", "input", "select", "textarea", "label", "a", "legend", "figcaption", "code", "pre"])
const SKIP = new Set(["link", "style", "script", "template"])
const elements = (el: Element) => [...el.children].filter((c) => !SKIP.has(c.localName)) as HTMLElement[]

export function PiecePreview({ item }: { item: string }) {
  const [shown, setShown] = React.useState<string | null>(null)
  const room = React.useRef<HTMLDivElement>(null)
  const body = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const off = afterOverture(() => {
      t = setTimeout(() => React.startTransition(() => setShown(item)), SETTLE)
    })
    return () => {
      off()
      clearTimeout(t)
    }
  }, [item])

  // A picture never moves the page: a piece that brings its own part into view as it mounts (Command's list does,
  // through cmdk) would scroll the window, and the scroll is what turns the rings to another piece.
  React.useEffect(() => {
    const r = room.current
    const own = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element, ...args: Parameters<Element["scrollIntoView"]>) {
      if (!r?.contains(this)) own.apply(this, args)
    }
    return () => {
      Element.prototype.scrollIntoView = own
    }
  }, [])

  React.useEffect(() => {
    const r = room.current, b = body.current
    if (!r || !b || !shown) return
    const out =(el: Element) => el.setAttribute("data-pt-out", "")
    const fit = () => {
      b.style.removeProperty("--pt-k")
      b.style.removeProperty("--pt-y")
      b.style.height = ""
      for (const el of b.querySelectorAll("[data-pt-out]")) el.removeAttribute("data-pt-out")
      const kids = elements(b)
      const root = kids.length > 1 ? b : kids[0]
      if (!root) return
      const parts = elements(root)
      if (!parts.length) return
      // Measured from the demo's own top, which still rises as it arrives, so the rise does not count as height.
      const top = root.getBoundingClientRect().top
      const foot = (el: Element) => el.getBoundingClientRect().bottom - top
      const reach = (els: Element[]) => Math.max(0, ...els.map(foot))
      const rh = r.clientHeight, rw = r.clientWidth
      const wide = Math.min(1, rw / Math.max(1, root.scrollWidth))
      // The first demo, with any heading or lead line above it.
      let lead = parts.findIndex((c) => c.offsetHeight >= LABEL)
      if (lead < 0) lead = parts.length - 1
      let k = Math.min(wide, rh / Math.max(1, reach(parts.slice(0, lead + 1))))
      let h: number
      if (k >= FLOOR) {
        // It fits at a size that reads: add the demos after it that fit whole, less a heading left without its demo.
        let last = lead + 1
        while (last < parts.length && foot(parts[last]) * k <= rh + 1) last++
        if (last > lead + 1 && last < parts.length && parts[last - 1].offsetHeight < LABEL) last--
        parts.slice(last).forEach(out)
        h = reach(parts.slice(0, last))
      } else {
        // Too tall to read whole: draw it at the floor and keep only the parts of it that end inside the room, going
        // into a part that crosses the edge and cutting there, down to the whole pictures, controls and lines.
        const kk = Math.min(wide, FLOOR), limit = rh / kk
        let kept = reach(parts.slice(0, lead))
        const cut = (el: Element) => {
          for (const c of elements(el)) {
            const f = foot(c)
            if (f <= limit) kept = Math.max(kept, f)
            else if (c.getBoundingClientRect().top - top >= limit || WHOLE.has(c.localName) || !c.childElementCount) out(c)
            else cut(c)
          }
        }
        cut(parts[lead])
        parts.slice(lead + 1).forEach(out)
        if (kept >= limit / 2) {
          k = kk
          h = kept
        } else {
          // What fits is too little to say what the piece is (one large picture, mostly): show it whole and smaller.
          for (const el of parts[lead].querySelectorAll("[data-pt-out]")) el.removeAttribute("data-pt-out")
          h = reach(parts.slice(0, lead + 1))
        }
      }
      b.style.height = `${Math.ceil(h)}px`
      b.style.setProperty("--pt-k", String(k))
      b.style.setProperty("--pt-y", `${Math.max(0, (rh - h * k) / 2)}px`)
    }
    // The body's height is set by the last fit, so a new piece arriving is seen by its own root changing size. The
    // pieces that left are let go of, so their trees are not kept alive by being watched.
    const ro = new ResizeObserver(fit)
    const watch = () => {
      ro.disconnect()
      ro.observe(r)
      for (const c of b.children) ro.observe(c)
      fit()
    }
    const mo = new MutationObserver(watch)
    mo.observe(b, { childList: true })
    watch()
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [shown])

  return (
    <div ref={room} className="pt-preview" aria-hidden="true" inert>
      <div ref={body} className="pt-preview-body doc-example" data-leaving={item !== shown || undefined}>
        {shown && <>
          <PreviewStyles item={shown} />
          <Still value={true}>
            <ItemExample key={shown} item={shown} />
          </Still>
        </>}
      </div>
    </div>
  )
}
