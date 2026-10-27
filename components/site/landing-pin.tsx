"use client"

import * as React from "react"

import { scrollPageTo } from "@/components/site/smooth-scroll"

// A section's question stays with you while you read its answer. When a section's title reaches the bar, a copy of
// it takes over in exactly the same place, size and face, and the scroll then shrinks it under the bar (never below a
// size you cannot miss), the section's number beside it. The section's name and its note scroll on up under the
// head's paper, and their copies come in beside the number once it has shrunk enough to make room, so the head
// carries the whole margin: what the section is, and what it says about itself. The copy's paper and hairline arrive
// as it shrinks, so the hand-over cannot be seen.
// When the section ends, the rule under it pushes the copy out and the next title takes over at the bar, as a book's
// next chapter takes the running head. The real parts stay in the page for assistive technology; only their paint
// steps aside while the copy stands in for them. Clicking the pinned title returns to the start of its section.
// Nothing moves by itself: every frame is asked for by a scroll, a resize, a retune or a font arriving.

const THEME = ["data-scheme", "data-pair", "data-key", "data-mode"]
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const px = (v: string) => parseFloat(v) || 0

type Sec = { el: HTMLElement; title: HTMLElement; num: HTMLElement | null; name: HTMLElement | null; note: HTMLElement | null }
// Typography and geometry are retuned outside the scroll callback, before any section takes over.
type Type = { size: number; css: Partial<CSSStyleDeclaration> }
type Face = {
  title: Type; num: Type; name: Type | null; note: Type | null
  nameWidth: number; noteWidth: number; sideGap: number
  measure: number; numDy: number; rule: number; lead: number; column: number; stack: boolean
  small: number; bare: boolean
}

export function SectionPin() {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const box = ref.current
    if (!box) return
    const part = (c: string) => box.querySelector<HTMLElement>(`.sec-pin-${c}`)!
    const numEl = part("num"), titleEl = part("title"), sideEl = part("side")
    const root = document.documentElement, bar = document.querySelector<HTMLElement>(".bar")
    const secs: Sec[] = [...document.querySelectorAll<HTMLElement>(".landing .sec:not([data-pin='off'])")].flatMap((el) => {
      const title = el.querySelector<HTMLElement>(":scope > .stave > .sec-title")
      const q = (c: string) => el.querySelector<HTMLElement>(`:scope > .sec-margin .sec-${c}`)
      return title ? [{ el, title, num: q("num"), name: q("name"), note: q("note") }] : []
    })
    const nameEl = part("name"), noteEl = part("note")
    const still = matchMedia("(prefers-reduced-motion: reduce)")
    let at = -1, raf = 0, tuning = 0, measuring = 0, shift = 0, k = 0, bottom = 0, edge = 0
    let faces: Face[] = [], probes: HTMLElement[] = [], height = 0, dirty = true

    // Read the whole face before copying any of it. No computed-style object survives into the write phase.
    const type = (el: HTMLElement): Type => {
      const cs = getComputedStyle(el), size = px(cs.fontSize)
      return { size, css: {
        fontFamily: cs.fontFamily,
        fontWeight: cs.fontWeight,
        fontStretch: cs.fontStretch,
        fontVariationSettings: cs.fontVariationSettings,
        fontFeatureSettings: cs.fontFeatureSettings,
        fontVariantNumeric: cs.fontVariantNumeric,
        textTransform: cs.textTransform,
        letterSpacing: cs.letterSpacing === "normal" ? "normal" : `${px(cs.letterSpacing) / size}em`,
        lineHeight: cs.lineHeight === "normal" ? "normal" : `${px(cs.lineHeight) / size}`,
        paddingTop: `${px(cs.paddingTop) / size}em`,
      } }
    }
    const copy = (el: HTMLElement, face: Type) => Object.assign(el.style, face.css, { fontSize: `${face.size}px` })
    const take = (i: number) => {
      if (at >= 0 && at !== i) secs[at].el.removeAttribute("data-pinned")
      at = i
      box.hidden = i < 0
      if (i < 0) return void bar?.style.removeProperty("--pin-k")
      const s = secs[i], f = faces[i]
      shift = 0
      numEl.style.translate = ""
      titleEl.innerHTML = `<i class="sec-pin-base"></i>${s.title.innerHTML}`
      numEl.innerHTML = `<i class="sec-pin-base"></i>`
      numEl.append(s.num?.textContent ?? "")
      copy(titleEl, f.title)
      copy(numEl, f.num)
      for (const [el, real, face, width] of [[nameEl, s.name, f.name, f.nameWidth], [noteEl, s.note, f.note, f.noteWidth]] as const) {
        el.textContent = real?.textContent ?? ""
        el.hidden = !real
        if (!face) continue
        copy(el, face)
        el.style.inlineSize = `${width}px`
      }
      sideEl.style.rowGap = `${f.sideGap}px`
      box.toggleAttribute("data-stack", f.stack)
      box.toggleAttribute("data-alone", s.num === null)
      box.toggleAttribute("data-bare", f.bare)
      box.style.gridTemplateColumns = f.stack ? "" : `${f.lead}px minmax(0, 1fr)`
      s.el.setAttribute("data-pinned", f.bare ? "" : "note")
    }

    const push = () => {
      if (at < 0) return
      const out = Math.max(0, height - (bottom + faces[at].rule - edge))
      box.style.translate = `0 ${-out}px`
      box.style.clipPath = out ? `inset(${out}px 0 0)` : ""
    }
    // Font-size must still rebreak the title. Let the browser finish that layout, then read all baseline markers
    // before writing the number's translation. ResizeObserver runs before paint, so no intermediate alignment shows.
    const aligned = new ResizeObserver(() => {
      if (at < 0 || dirty) return
      const f = faces[at], b = box.getBoundingClientRect()
      let nextShift = 0
      if (!f.stack) {
        const n = numEl.getBoundingClientRect(), t = titleEl.getBoundingClientRect()
        const titleBase = titleEl.firstElementChild!.getBoundingClientRect().top
        const numBase = numEl.firstElementChild!.getBoundingClientRect().top
        nextShift = Math.round(mix(f.numDy - (n.top - shift - t.top), titleBase - numBase + shift, k))
      }
      height = b.height
      shift = nextShift
      numEl.style.translate = f.stack ? "" : `0 ${shift}px`
      push()
    })
    aligned.observe(box)

    const read = () => {
      raf = 0
      if (dirty) return
      // Every geometry read is before take() or any frame write. Only the source title and section move on scroll.
      edge = bar ? bar.getBoundingClientRect().bottom : 0
      const rects = secs.map((s) => ({ title: s.title.getBoundingClientRect(), section: s.el.getBoundingClientRect() }))
      let next = -1
      rects.forEach((r, i) => { if (r.title.top < edge && r.section.bottom > edge) next = i })
      const changed = next !== at
      // A retune forgets the section it held, so a pin still showing is put away here even when nothing changed.
      if (next < 0) { if (changed || !box.hidden) take(next); return }
      const f = faces[next], r = rects[next]
      const reach = Math.min(360, Math.max(200, f.title.size * 3))
      k = still.matches ? 1 : Math.min(1, Math.max(0, (edge - r.title.top) / reach))
      bottom = r.section.bottom
      if (changed) {
        // Entrance translations have finished at hand-over. Read these offsets here, rather than caching the
        // different translated positions of labels and notes while they are still below the viewport.
        const s = secs[next], n = s.num?.getBoundingClientRect()
        const name = s.name?.getBoundingClientRect(), note = s.note?.getBoundingClientRect()
        f.numDy = n ? n.top - r.title.top : 0
        f.sideGap = name && note ? Math.max(0, note.top - name.bottom) : 0
        take(next)
      }
      box.style.setProperty("--k", `${k}`)
      // Only the bar consumes this value. Putting it on html invalidates every descendant's inherited style.
      bar?.style.setProperty("--pin-k", `${k}`)
      titleEl.style.fontSize = `${mix(f.title.size, f.small, k)}px`
      titleEl.style.maxInlineSize = `${Math.round(mix(f.measure, Math.max(f.measure, f.column), k))}px`
      numEl.style.fontSize = `${mix(f.num.size, f.small * 1.1, k)}px`
      // Request a post-layout delivery even if rounding kept the box at the same size. The baseline interpolation
      // still depends on k, and a new section can have exactly the same dimensions as the one it replaces.
      aligned.unobserve(box)
      aligned.observe(box)
      push()
    }
    const ask = () => { if (!raf) raf = requestAnimationFrame(read) }
    const clearProbes = () => { probes.forEach((probe) => probe.remove()); probes = [] }
    const measure = () => {
      tuning = 0
      // Batch source reads first. The temporary pins are only for the unwrapped line and number widths, never paint.
      const snapshots = secs.map((s) => {
        const title = type(s.title), num = s.num ? type(s.num) : title
        const t = s.title.getBoundingClientRect(), n = s.num?.getBoundingClientRect()
        const name = s.name ? type(s.name) : null, note = s.note ? type(s.note) : null
        const nameRect = s.name?.getBoundingClientRect(), noteRect = s.note?.getBoundingClientRect()
        return { title, num, name, note, nameWidth: Math.ceil(nameRect?.width ?? 0), noteWidth: Math.ceil(noteRect?.width ?? 0),
          sideGap: nameRect && noteRect ? Math.max(0, noteRect.top - nameRect.bottom) : 0,
          measure: t.width, numDy: n ? n.top - t.top : 0, rule: px(getComputedStyle(s.el).borderTopWidth), left: t.left, right: t.right }
      })
      clearProbes()
      probes = snapshots.map((f, i) => {
        const probe = box.cloneNode(true) as HTMLElement
        probe.hidden = false
        probe.removeAttribute("data-stack")
        probe.removeAttribute("data-alone")
        probe.removeAttribute("data-bare")
        Object.assign(probe.style, { visibility: "hidden", translate: "none", clipPath: "none", pointerEvents: "none" })
        const title = probe.querySelector<HTMLElement>(".sec-pin-title")!, num = probe.querySelector<HTMLElement>(".sec-pin-num")!
        copy(title, f.title)
        title.innerHTML = secs[i].title.innerHTML
        title.style.whiteSpace = "nowrap"
        title.style.maxInlineSize = "none"
        copy(num, f.num)
        num.textContent = secs[i].num?.textContent ?? ""
        box.parentElement!.append(probe)
        return probe
      })
      // A separate frame lets layout resolve the probes together, rather than flushing it for each section.
      measuring = requestAnimationFrame(() => {
        measuring = 0
        faces = probes.map((probe, i) => {
          const f = snapshots[i], b = probe.getBoundingClientRect(), cs = getComputedStyle(probe)
          const start = px(cs.paddingInlineStart), end = px(cs.paddingInlineEnd)
          const lead = Math.max(0, Math.round(cs.direction === "rtl" ? b.right - end - f.right : f.left - b.left - start))
          const stack = lead < f.title.size, column = probe.clientWidth - start - end - (stack ? 0 : lead)
          const title = probe.querySelector<HTMLElement>(".sec-pin-title")!, num = probe.querySelector<HTMLElement>(".sec-pin-num")!
          const range = document.createRange()
          range.selectNodeContents(title)
          const line = range.getBoundingClientRect().width / f.title.size
          const fit = stack ? Math.max(22, Math.floor((column - 2) / line)) : Infinity
          const small = Math.min(f.title.size, fit, Math.max(f.title.size * 0.6, stack ? 26 : 40))
          const last = num.offsetWidth / f.num.size * small * 1.1
          const gap = px(getComputedStyle(num.parentElement!).columnGap)
          return { ...f, lead, stack, column, small, bare: stack || !f.note || last + gap + f.noteWidth > lead }
        })
        clearProbes()
        dirty = false
        // Recopy the active face after a font, viewport or theme change, even when the section did not change.
        if (at >= 0) { secs[at].el.removeAttribute("data-pinned"); at = -1 }
        ask()
      })
    }
    const retune = () => {
      dirty = true
      cancelAnimationFrame(measuring)
      if (!tuning) tuning = requestAnimationFrame(measure)
    }
    const back = () => {
      if (at < 0) return
      scrollPageTo(secs[at].title, still.matches)
    }

    retune()
    addEventListener("scroll", ask, { passive: true })
    addEventListener("resize", retune)
    still.addEventListener("change", ask)
    document.fonts.addEventListener("loadingdone", retune)
    box.addEventListener("click", back)
    const mo = new MutationObserver(retune)
    mo.observe(root, { attributes: true, attributeFilter: [...THEME, "dir"] })
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(tuning)
      cancelAnimationFrame(measuring)
      aligned.disconnect()
      clearProbes()
      removeEventListener("scroll", ask)
      removeEventListener("resize", retune)
      still.removeEventListener("change", ask)
      document.fonts.removeEventListener("loadingdone", retune)
      box.removeEventListener("click", back)
      mo.disconnect()
      secs.forEach((s) => s.el.removeAttribute("data-pinned"))
      bar?.style.removeProperty("--pin-k")
    }
  }, [])

  return (
    <div ref={ref} className="sec-pin" aria-hidden="true" hidden>
      <span className="sec-pin-margin">
        <span className="sec-pin-num" />
        <span className="sec-pin-side">
          <span className="sec-pin-name" />
          <span className="sec-pin-note" />
        </span>
      </span>
      <span className="sec-pin-title" />
    </div>
  )
}
