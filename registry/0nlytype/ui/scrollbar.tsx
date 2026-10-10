"use client"

import * as React from "react"

import { useComposedRefs } from "@/registry/0nlytype/lib/refs"
import { cn } from "@/registry/0nlytype/lib/utils"

type ScrollbarSection = {
  id: string
  /** The numeral on the mark: "II". */
  num: string
  name: string
  /** Pins the mark's place on the rail (0 to 1) instead of measuring it. For documentation. */
  at?: number
}

type ScrollbarOptions = {
  /** inner: the ruler inside a scroller; page: fixed to the window; numeral: the thumb is how far you are, as a figure; leaves: a disc for every screenful. */
  variant?: "inner" | "page" | "numeral" | "leaves"
  /** Which way the host scrolls. Inner only: the page always scrolls down. */
  axis?: "y" | "x"
  /** The thumb is never shorter than this many px, so it can be held. */
  min?: number
  sections?: ScrollbarSection[]
  /** Leave the rail as drawn (documentation pins its look). */
  still?: boolean
}

/** One leaf's step down the rail, in px: .ot-scrollbar-leaf is 1.125rem tall. */
const LEAF = 18 // ponytail: assumes a 16px root; read it from the first leaf if a page ever sets its own

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches

// A page can contain several rails. Read every rail before any of them changes styles,
// including the section marks and leaves within each rail.
const measurements = new Set<() => () => void>()
let measurementFrame = 0
function queueMeasurement(read: () => () => void) {
  measurements.add(read)
  if (measurementFrame) return
  measurementFrame = requestAnimationFrame(() => {
    measurementFrame = 0
    const writes = [...measurements].map((measure) => measure())
    measurements.clear()
    writes.forEach((write) => write())
  })
}

/** The nearest box around the rail that scrolls its way, or the rail's parent when none does (a dialog scrolls only once it is open). */
function scroller(rail: HTMLElement, across: boolean) {
  for (let p = rail.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p)[across ? "overflowX" : "overflowY"])) return p
  }
  return rail.parentElement
}

/**
 * Returns the ref for the rail. Measures the rail's host (the nearest scroller around it, or the document for the page
 * variant) and drives the rail: --view (thumb length), --max (how far the rail travels), data-idle (nothing to
 * scroll) and data-ready. The thumb's travel itself is CSS, on the scroller's timeline.
 * Once ready the host says so (data-scrollbar-host), which hides the browser's own bar there and keeps smooth-scroll
 * libraries out of it (data-lenis-prevent, while there is something to scroll).
 */
function useScrollbar({ variant = "inner", axis = "y", min = 24, sections = [], still = false }: ScrollbarOptions) {
  const key = JSON.stringify(sections)
  const [el, setEl] = React.useState<HTMLDivElement | null>(null)

  React.useEffect(() => {
    // The rail needs scroll-driven animation and a pointer; elsewhere the native bar stays.
    if (!el || still || !matchMedia("(pointer: fine)").matches || !CSS.supports("animation-timeline: scroll()")) return
    const page = variant === "page"
    const across = axis === "x" && variant === "inner"
    const host = page ? document.documentElement : scroller(el, across)
    if (!host) return
    const thumb = el.querySelector<HTMLElement>("[data-slot=scrollbar-thumb]")!
    const marks = [...el.querySelectorAll<HTMLElement>("[data-slot=scrollbar-mark]")]
    const leafRow = variant === "leaves" ? el.querySelector<HTMLElement>("[data-slot=scrollbar-leaves]") : null
    let leafStarts: number[] = []
    const wanted = JSON.parse(key) as ScrollbarSection[]
    const target = (i: number) => document.getElementById(wanted[i].id)
    const rtl = () => getComputedStyle(host).direction === "rtl"
    const seen = () => (page ? innerHeight : across ? host.clientWidth : host.clientHeight)
    const whole = () => (across ? host.scrollWidth : host.scrollHeight)
    const top = () => (page ? scrollY : across ? Math.abs(host.scrollLeft) : host.scrollTop)
    // A section's offset from the top of the scrolled content (sideways, from its inline start: the right, in right-to-left).
    const offset = (s: HTMLElement) => {
      if (across) {
        const r = s.getBoundingClientRect(), h = host.getBoundingClientRect()
        return (rtl() ? h.right - r.right : r.left - h.left) + top()
      }
      return s.getBoundingClientRect().top - (page ? 0 : host.getBoundingClientRect().top) + top()
    }
    // A rail is absolute: its host must be a positioned box (unless it already is: a dialog is fixed).
    const pin = !page && getComputedStyle(host).position === "static"
    const hadPrevent = host.hasAttribute("data-lenis-prevent")
    // The layout is read when it can change (a resize, new content); a scroll only moves which mark you're in, from the
    // offset the scroll event read while the page was still laid out. Scrolling reads no layout.
    let geo: { shown: number; all: number; max: number; offsets: (number | null)[]; fit: number } | null = null
    let at = 0
    const place = () => {
      if (!geo) return
      const { shown, all, max, offsets, fit } = geo
      // The mark for the section in the middle of the view is the one you're in.
      const middle = at + shown / 2
      let now = -1
      offsets.forEach((y, i) => { if (y !== null && y <= middle) now = i })
      marks.forEach((mark, i) => mark.toggleAttribute("data-now", i === now))
      if (leafRow) leaves(shown, all, max, fit, at)
    }
    const step = () => place
    // The thumb's top travels (1 − view) of the rail, so a mark sits where the thumb's top
    // will be when its section reaches the top. A section too near the end to reach the top sits as far on,
    // inside the thumb's last stretch, where it will be in the view: the last few marks never land on one another.
    const measure = () => {
      const shown = seen(), all = page ? host.scrollHeight : whole(), max = all - shown
      // The numeral's thumb is its figure, so it travels the rail less its own height.
      const view = variant === "numeral" ? thumb.offsetHeight / el.clientHeight || 1 : Math.min(1, Math.max(shown / all, min / (page ? el.clientHeight : shown))) || 1 // a closed box measures 0 / 0
      const direction = rtl() ? "-1" : "1"
      const offsets = marks.map((_, i) => {
        const s = target(i)
        return s ? offset(s) : null
      })
      const fit = leafRow ? Math.max(1, Math.floor(el.clientHeight / LEAF)) : 1
      at = top()
      return () => {
        geo = { shown, all, max, offsets, fit }
        el.style.setProperty("--view", String(view))
        el.style.setProperty("--max", `${max}px`)
        el.style.setProperty("--dir", direction) // a horizontal rail travels the other way in right-to-left
        el.toggleAttribute("data-idle", max < 1)
        // Smooth scrolling leaves this box's wheel alone while it has something to scroll (a sideways one never needs it).
        if (!page && !across && !hadPrevent) host.toggleAttribute("data-lenis-prevent", max >= 1)
        marks.forEach((mark, i) => {
          const y = offsets[i]
          if (y !== null) mark.style.setProperty("--at", String(max > 0 ? (y / max) * (1 - view) : 0))
        })
        place()
        el.setAttribute("data-ready", "")
        host.setAttribute("data-scrollbar-host", pin ? "pin" : "")
      }
    }
    // A disc for each screenful (a leaf), from the top. When they won't fit down the rail, a disc holds as many leaves as it must.
    const leaves = (shown: number, all: number, max: number, fit: number, at: number) => {
      const n = Math.max(1, Math.ceil(all / shown - 0.01))
      const per = Math.ceil(n / fit), count = Math.ceil(n / per)
      leafStarts = Array.from({ length: count }, (_, j) => Math.min(j * per * shown, max))
      if (leafRow!.childElementCount !== count) {
        leafRow!.replaceChildren(...leafStarts.map((_, j) => {
          const leaf = document.createElement("span")
          leaf.setAttribute("data-slot", "scrollbar-leaf")
          leaf.setAttribute("data-leaf", `${j + 1}/${count}`)
          leaf.className = "ot-scrollbar-leaf"
          return leaf
        }))
      }
      let now = 0
      leafStarts.forEach((y, j) => { if (y <= at + 1) now = j })
      ;[...leafRow!.children].forEach((leaf, j) => {
        leaf.toggleAttribute("data-read", j < now)
        leaf.toggleAttribute("data-now", j === now)
      })
    }

    const soon = () => queueMeasurement(measure)
    const scrolled: EventTarget = page ? window : host
    const resize = new ResizeObserver(soon)
    resize.observe(el)
    // Content that redraws changes what there is to scroll without resizing the box.
    const mutation = new MutationObserver(soon)
    if (page) {
      resize.observe(document.body)
      addEventListener("resize", soon)
    } else {
      resize.observe(host)
      mutation.observe(host, { childList: true, subtree: true, characterData: true })
    }
    const onScroll = () => {
      at = top()
      queueMeasurement(step)
    }
    if (marks.length || leafRow) scrolled.addEventListener("scroll", onScroll, { passive: true })
    soon()

    const scrollToY = (y: number, instant: boolean) => {
      const behavior = instant || reduced() ? "instant" : "smooth"
      if (across) host.scrollTo({ left: rtl() ? -y : y, behavior })
      else (page ? window : host).scrollTo({ top: y, behavior })
    }
    const onPointerDown = (e: PointerEvent) => {
      if (e.button) return
      e.preventDefault() // keep focus where it is
      const mark = (e.target as HTMLElement).closest<HTMLElement>("[data-slot=scrollbar-mark]")
      if (mark) {
        const s = target(marks.indexOf(mark))
        if (s) scrollToY(offset(s), false)
        return
      }
      // Leaves have no thumb: pressing a disc turns to its leaf.
      if (leafRow) {
        const leaf = (e.target as HTMLElement).closest("[data-slot=scrollbar-leaf]")
        const j = leaf ? [...leafRow.children].indexOf(leaf) : -1
        if (j >= 0) scrollToY(leafStarts[j], false)
        return
      }
      // Take the thumb where you grabbed it; press the rail and the thumb centres on the pointer.
      const r = el.getBoundingClientRect(), t = thumb.getBoundingClientRect()
      const grab = e.target === thumb ? (across ? e.clientX - t.left : e.clientY - t.top) : (across ? t.width : t.height) / 2
      const follow = (ev: PointerEvent) => {
        const max = (page ? host.scrollHeight : whole()) - seen()
        let share = across ? (ev.clientX - r.left - grab) / (r.width - t.width) : (ev.clientY - r.top - grab) / (r.height - t.height)
        if (across && rtl()) share = 1 - share
        scrollToY(Math.max(0, Math.min(max, share * max)), true)
      }
      follow(e)
      el.setPointerCapture(e.pointerId)
      el.setAttribute("data-dragging", "")
      el.addEventListener("pointermove", follow)
      el.addEventListener("lostpointercapture", () => {
        el.removeEventListener("pointermove", follow)
        el.removeAttribute("data-dragging")
      }, { once: true })
    }
    el.addEventListener("pointerdown", onPointerDown)

    return () => {
      measurements.delete(measure)
      measurements.delete(step)
      if (!measurements.size) { cancelAnimationFrame(measurementFrame); measurementFrame = 0 }
      resize.disconnect()
      mutation.disconnect()
      removeEventListener("resize", soon)
      scrolled.removeEventListener("scroll", onScroll)
      el.removeEventListener("pointerdown", onPointerDown)
      el.removeAttribute("data-ready")
      host.removeAttribute("data-scrollbar-host")
      if (!hadPrevent) host.removeAttribute("data-lenis-prevent")
    }
  }, [el, variant, axis, min, key, still])
  return setEl
}

type ScrollbarProps = Omit<React.ComponentProps<"div">, "children"> &
  Omit<ScrollbarOptions, "still"> & {
    /** Pins a look for documentation ("hover", "active") and leaves the rail as drawn: set --view and --p yourself. */
    "data-force"?: string
  }

/**
 * A scrollbar as a ruler: a hairline and a thumb as long as the view. Place it inside any scroll container
 * (as its last child, or deeper: it finds the scroller around it) and it pins to that container's edge;
 * axis="x" is the same rail along the bottom of a box that scrolls sideways; variant="page" fixes it
 * to the window and measures the document. variant="numeral" makes the thumb a figure, how far down you are
 * (00 to 100), riding the hairline on a dot; variant="leaves" draws a disc for every screenful instead of a thumb:
 * read ones ink, the one you're on the accent, those to come rings. Both run down the side only.
 *
 * It is a pointer aid, hidden from assistive technology: keyboard scrolling stays native, and
 * the sections are marks on the rail that scroll to the element with that id. Anyone who can't point still needs
 * those sections elsewhere on the page (a table of contents).
 */
function Scrollbar({ variant = "inner", axis = "y", min = variant === "page" ? 40 : 24, sections, className, "data-force": force, ref: forwardedRef, ...props }: ScrollbarProps) {
  const rail = useScrollbar({ variant, axis, min, sections, still: force !== undefined })
  const composedRef = useComposedRefs(rail, forwardedRef)
  return (
    <div ref={composedRef} data-force={force} data-slot="scrollbar" data-variant={variant} data-axis={variant === "inner" && axis === "x" ? "x" : undefined} aria-hidden="true" className={cn("ot-scrollbar", className)} {...props}>
      <span data-slot="scrollbar-thumb" className="ot-scrollbar-thumb" />
      {variant === "leaves" && <span data-slot="scrollbar-leaves" className="ot-scrollbar-leaves" />}
      {sections?.map((s, i) => (
        <span key={s.id} data-slot="scrollbar-mark" data-num={s.num} data-name={s.name} style={{ "--i": i, "--at": s.at } as React.CSSProperties} className="ot-scrollbar-mark" />
      ))}
    </div>
  )
}

export { Scrollbar, useScrollbar, type ScrollbarProps, type ScrollbarSection }
