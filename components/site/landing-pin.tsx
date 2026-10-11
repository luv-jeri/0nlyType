"use client"

import * as React from "react"

// A section's question stays with you while you read its answer. When a section's title reaches the bar, a copy of
// it takes over in exactly the same place, size and face, and the scroll then shrinks it under the bar to half its
// size (never below a size you cannot miss), the section's number beside it. The copy's paper and hairline arrive as
// it shrinks, so the hand-over cannot be seen. When the section ends, the rule under it pushes the copy out and the
// next title takes over at the bar, as a book's next chapter takes the running head. The real title stays in the page
// for assistive technology; only its paint steps aside while the copy stands in for it. Clicking the pinned title
// returns to the start of its section.
// Nothing moves by itself: every frame is asked for by a scroll, a resize, a retune or a font arriving.

const THEME = ["data-scheme", "data-pair", "data-key", "data-mode"]
const mix = (a: number, b: number, k: number) => a + (b - a) * k
const px = (v: string) => parseFloat(v) || 0

type Sec = { el: HTMLElement; title: HTMLElement; num: HTMLElement | null }
// What a pin copies from its section when it takes over, read again on a resize or a retune.
type Face = { size: number; numSize: number; measure: number; numDy: number; rule: number }

export function SectionPin() {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const box = ref.current
    if (!box) return
    const numEl = box.querySelector<HTMLElement>(".sec-pin-num")!, titleEl = box.querySelector<HTMLElement>(".sec-pin-title")!
    const root = document.documentElement, bar = document.querySelector<HTMLElement>(".bar")
    const secs: Sec[] = [...document.querySelectorAll<HTMLElement>(".landing .sec")].flatMap((el) => {
      const title = el.querySelector<HTMLElement>(":scope > .stave > .sec-title")
      return title ? [{ el, title, num: el.querySelector<HTMLElement>(":scope > .sec-margin .sec-num") }] : []
    })
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
      // Each part leads with a mark of no size that sits on its first baseline, so the two can be lined up by it.
      shift = 0
      numEl.style.translate = ""
      titleEl.innerHTML = `<i class="sec-pin-base"></i>${s.title.innerHTML}`
      numEl.innerHTML = `<i class="sec-pin-base"></i>`
      numEl.append(s.num?.textContent ?? "")
      const size = copy(s.title, titleEl), numSize = s.num ? copy(s.num, numEl) : size
      const t = s.title.getBoundingClientRect(), n = s.num?.getBoundingClientRect()
      // The measure in ems of the title's own size, so the copy breaks its lines where the title does.
      face = { size, numSize, measure: t.width / size, numDy: n ? n.top - t.top : 0, rule: px(getComputedStyle(s.el).borderTopWidth) }
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
      const phone = innerWidth <= 760
      // How far the scroll has carried the title past the bar: 0 where it meets it, 1 once it has shrunk.
      const reach = Math.min(360, Math.max(200, face.size * 3))
      const k = still.matches ? 1 : Math.min(1, Math.max(0, (edge - t.top) / reach))
      const small = Math.min(face.size, Math.max(face.size * 0.5, phone ? 22 : 34))
      box.style.setProperty("--k", `${k}`)
      root.style.setProperty("--pin-k", `${k}`)
      // The title's column starts where the title does, on whichever side the page reads from.
      const b = box.getBoundingClientRect(), cs = getComputedStyle(box)
      const lead = Math.max(0, Math.round(cs.direction === "rtl" ? b.right - px(cs.paddingInlineEnd) - t.right : t.left - b.left - px(cs.paddingInlineStart)))
      box.style.gridTemplateColumns = `${lead}px minmax(0, 1fr)`
      // It hands over at the title's own measure, then opens to its whole column as it shrinks, so a title that took
      // three lines on a phone settles on fewer under the bar.
      const column = box.clientWidth - px(cs.paddingInlineStart) - px(cs.paddingInlineEnd) - lead, measure = face.measure * face.size
      titleEl.style.fontSize = `${mix(face.size, small, k)}px`
      titleEl.style.maxInlineSize = `${Math.round(mix(measure, Math.max(measure, column), k))}px`
      numEl.style.fontSize = `${mix(face.numSize, small * 1.1, k)}px`
      // The number stands only where its margin has room for it (not on a phone, where the title spans the page).
      const room = !phone && s.num !== null && numEl.offsetWidth < lead
      box.toggleAttribute("data-alone", !room)
      // At the hand-over the number sits where the section set it; by the end it shares the title's baseline.
      // Measured on the screen, less the shift the number already carries.
      const top = (e: Element) => e.getBoundingClientRect().top
      const natural = top(numEl) - shift - top(titleEl), base = top(titleEl.firstElementChild!) - (top(numEl.firstElementChild!) - shift)
      shift = Math.round(mix(face.numDy - natural, base, k))
      numEl.style.translate = `0 ${shift}px`
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
      <span className="sec-pin-num" />
      <span className="sec-pin-title" />
    </div>
  )
}
