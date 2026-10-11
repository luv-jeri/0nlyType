"use client"

import * as React from "react"

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
const top = (e: Element) => e.getBoundingClientRect().top

type Sec = { el: HTMLElement; title: HTMLElement; num: HTMLElement | null; name: HTMLElement | null; note: HTMLElement | null }
// What a pin copies from its section when it takes over, read again on a resize or a retune.
type Face = { size: number; numSize: number; measure: number; line: number; numDy: number; rule: number }

export function SectionPin() {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const box = ref.current
    if (!box) return
    const part = (c: string) => box.querySelector<HTMLElement>(`.sec-pin-${c}`)!
    const numEl = part("num"), titleEl = part("title"), sideEl = part("side")
    const root = document.documentElement, bar = document.querySelector<HTMLElement>(".bar")
    const secs: Sec[] = [...document.querySelectorAll<HTMLElement>(".landing .sec")].flatMap((el) => {
      const title = el.querySelector<HTMLElement>(":scope > .stave > .sec-title")
      const q = (c: string) => el.querySelector<HTMLElement>(`:scope > .sec-margin .sec-${c}`)
      return title ? [{ el, title, num: q("num"), name: q("name"), note: q("note") }] : []
    })
    const nameEl = part("name"), noteEl = part("note")
    const still = matchMedia("(prefers-reduced-motion: reduce)")
    let at = -1, raf = 0, shift = 0, face: Face | null = null

    // Copies the section's own type on to the pin: the words with their italic, and the face as it is set now.
    const copy = (face: HTMLElement, onto: HTMLElement) => {
      const cs = getComputedStyle(face), size = px(cs.fontSize)
      onto.style.fontFamily = cs.fontFamily
      onto.style.fontWeight = cs.fontWeight
      onto.style.setProperty("font-stretch", cs.getPropertyValue("font-stretch"))
      onto.style.fontVariationSettings = cs.fontVariationSettings
      onto.style.fontFeatureSettings = cs.fontFeatureSettings
      onto.style.fontVariantNumeric = cs.fontVariantNumeric
      onto.style.textTransform = cs.textTransform
      onto.style.letterSpacing = cs.letterSpacing === "normal" ? "normal" : `${px(cs.letterSpacing) / size}em`
      onto.style.lineHeight = cs.lineHeight === "normal" ? "normal" : `${px(cs.lineHeight) / size}`
      onto.style.paddingTop = `${px(cs.paddingTop) / size}em`
      return size
    }
    const take = (i: number) => {
      if (at >= 0 && at !== i) secs[at].el.removeAttribute("data-pinned")
      at = i
      face = null
      box.hidden = i < 0
      if (i < 0) return void root.style.removeProperty("--pin-k")
      const s = secs[i]
      s.el.setAttribute("data-pinned", "")
      // The title and the number lead with a mark of no size that sits on their first baseline, to line them up by.
      shift = 0
      numEl.style.translate = ""
      titleEl.innerHTML = `<i class="sec-pin-base"></i>${s.title.innerHTML}`
      numEl.innerHTML = `<i class="sec-pin-base"></i>`
      numEl.append(s.num?.textContent ?? "")
      const size = copy(s.title, titleEl), numSize = s.num ? copy(s.num, numEl) : size
      // The name and the note keep their own size and their own line breaks, so they read as the margin set them.
      for (const [el, real] of [[nameEl, s.name], [noteEl, s.note]] as const) {
        el.textContent = real?.textContent ?? ""
        el.hidden = !real
        if (!real) continue
        el.style.fontSize = `${copy(real, el)}px`
        el.style.inlineSize = `${Math.ceil(real.getBoundingClientRect().width)}px`
      }
      // The gap between the name and the note is the one the margin sets.
      sideEl.style.rowGap = s.name && s.note ? `${Math.max(0, top(s.note) - s.name.getBoundingClientRect().bottom)}px` : ""
      const t = s.title.getBoundingClientRect(), n = s.num?.getBoundingClientRect()
      // The title's length on one line, in ems, so a phone can tell the size at which it holds to one line.
      titleEl.style.fontSize = `${size}px`
      titleEl.style.whiteSpace = "nowrap"
      const range = document.createRange()
      range.selectNodeContents(titleEl)
      const line = range.getBoundingClientRect().width / size
      titleEl.style.whiteSpace = ""
      // The measure in ems of the title's own size, so the copy breaks its lines where the title does.
      face = { size, numSize, measure: t.width / size, line, numDy: n ? n.top - t.top : 0, rule: px(getComputedStyle(s.el).borderTopWidth) }
    }

    const read = () => {
      raf = 0
      const edge = bar ? bar.getBoundingClientRect().bottom : 0
      // A section holds the pin from its title reaching the bar until the section ends. (Not until the next title
      // arrives: 04's title is held below the bar through its whole pull, and 03 would stand over it.)
      let next = -1
      secs.forEach((s, i) => {
        if (s.title.getBoundingClientRect().top < edge && s.el.getBoundingClientRect().bottom > edge) next = i
      })
      if (next !== at || !face) take(next)
      if (next < 0 || !face) return
      const s = secs[next], t = s.title.getBoundingClientRect()
      // How far the scroll has carried the title past the bar: 0 where it meets it, 1 once it has shrunk.
      const reach = Math.min(360, Math.max(200, face.size * 3))
      const k = still.matches ? 1 : Math.min(1, Math.max(0, (edge - t.top) / reach))
      // The title's column starts where the title does, on whichever side the page reads from. Where it starts at the
      // page's margin (one column, on a phone), the section's name stands in a line over it instead.
      const b = box.getBoundingClientRect(), cs = getComputedStyle(box)
      const lead = Math.max(0, Math.round(cs.direction === "rtl" ? b.right - px(cs.paddingInlineEnd) - t.right : t.left - b.left - px(cs.paddingInlineStart)))
      const stack = lead < face.size
      const column = box.clientWidth - px(cs.paddingInlineStart) - px(cs.paddingInlineEnd) - (stack ? 0 : lead), measure = face.measure * face.size
      // On a phone a title that would just miss one line gives a little of its size to keep to it, never below 22px.
      const fit = stack ? Math.max(22, Math.floor((column - 2) / face.line)) : Infinity
      const small = Math.min(face.size, fit, Math.max(face.size * 0.6, stack ? 26 : 40))
      box.toggleAttribute("data-stack", stack)
      box.style.setProperty("--k", `${k}`)
      root.style.setProperty("--pin-k", `${k}`)
      box.style.gridTemplateColumns = stack ? "" : `${lead}px minmax(0, 1fr)`
      // It hands over at the title's own measure, then opens to its whole column as it shrinks, so a title that took
      // three lines on a phone settles on fewer under the bar.
      titleEl.style.fontSize = `${mix(face.size, small, k)}px`
      titleEl.style.maxInlineSize = `${Math.round(mix(measure, Math.max(measure, column), k))}px`
      numEl.style.fontSize = `${mix(face.numSize, small * 1.1, k)}px`
      box.toggleAttribute("data-alone", s.num === null)
      // The note stands only where the margin has room for it beside the number at its smallest, so it is decided once
      // for the whole scroll and never comes and goes on the way.
      const gap = px(getComputedStyle(numEl.parentElement!).columnGap), last = (numEl.offsetWidth / px(numEl.style.fontSize)) * small * 1.1
      const bare = stack || !s.note || last + gap + noteEl.offsetWidth > lead
      box.toggleAttribute("data-bare", bare)
      s.el.setAttribute("data-pinned", bare ? "" : "note")
      // At the hand-over the number sits where the section set it; by the end it shares the title's baseline.
      // Measured on the screen, less the shift it carries now.
      if (!stack) {
        const natural = top(numEl) - shift - top(titleEl), base = top(titleEl.firstElementChild!) - (top(numEl.firstElementChild!) - shift)
        shift = Math.round(mix(face.numDy - natural, base, k))
        numEl.style.translate = `0 ${shift}px`
      }
      // The rule that ends the section pushes the pin out, the pin's hairline lying on it, so the two lift away as
      // one line; what has gone up past the bar is cut away rather than left to show through its blur.
      const out = Math.max(0, box.getBoundingClientRect().height - (s.el.getBoundingClientRect().bottom + face.rule - edge))
      box.style.translate = `0 ${-out}px`
      box.style.clipPath = out ? `inset(${out}px 0 0)` : ""
    }
    const ask = () => { if (!raf) raf = requestAnimationFrame(read) }
    const retune = () => { face = null; ask() }
    const back = () => {
      if (at < 0) return
      secs[at].title.scrollIntoView({ block: "start", behavior: still.matches ? "auto" : "smooth" })
    }

    read()
    addEventListener("scroll", ask, { passive: true })
    addEventListener("resize", retune)
    still.addEventListener("change", ask)
    document.fonts.addEventListener("loadingdone", retune)
    box.addEventListener("click", back)
    const mo = new MutationObserver(retune)
    mo.observe(root, { attributes: true, attributeFilter: THEME })
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener("scroll", ask)
      removeEventListener("resize", retune)
      still.removeEventListener("change", ask)
      document.fonts.removeEventListener("loadingdone", retune)
      box.removeEventListener("click", back)
      mo.disconnect()
      secs.forEach((s) => s.el.removeAttribute("data-pinned"))
      root.style.removeProperty("--pin-k")
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
