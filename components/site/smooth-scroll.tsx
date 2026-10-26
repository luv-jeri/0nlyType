"use client"

import * as React from "react"

let scroller: import("lenis").default | undefined

/** Page controls use the same scroll engine as the wheel, so native easing never fights Lenis. */
export function scrollPageTo(target: number | HTMLElement, immediate = false) {
  if (scroller) scroller.scrollTo(target, { immediate })
  else if (typeof target === "number") scrollTo({ top: target, behavior: immediate ? "instant" : "smooth" })
  else target.scrollIntoView({ block: "start", behavior: immediate ? "instant" : "smooth" })
}

/** Lenis loads on the first input, only while reduced motion is off. */
export function SmoothScroll() {
  React.useEffect(() => {
    const still = matchMedia("(prefers-reduced-motion: reduce)")
    let gone = false
    let requested = false
    // Native scrolling works immediately; no Lenis bytes are requested on the hero's initial path.
    const start = () => {
      if (requested || still.matches) return
      requested = true
      import("lenis").then(({ default: Lenis }) => {
        if (gone || still.matches) { requested = false; return }
        // Lenis 1.3.26 reads scroll-padding and scroll-margin itself; adding the old -96 offset would count it twice.
        scroller = new Lenis({ autoRaf: true, anchors: true })
      }).catch(() => { requested = false })
    }
    const events = ["wheel", "pointerdown", "keydown"] as const
    events.forEach((event) => addEventListener(event, start, { passive: true }))
    const stop = () => {
      if (!still.matches) return
      if (scroller) {
        scroller.destroy()
        scroller = undefined
        requested = false
      }
    }
    still.addEventListener("change", stop)
    return () => {
      gone = true
      events.forEach((event) => removeEventListener(event, start))
      still.removeEventListener("change", stop)
      scroller?.destroy()
      scroller = undefined
    }
  }, [])
  return null
}
