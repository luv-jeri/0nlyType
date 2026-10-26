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
    const previousScrollTo = window.__otScrollTo
    window.__otScrollTo = scrollPageTo
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
        scroller = new Lenis({ autoRaf: true, anchors: false })
      }).catch(() => { requested = false })
    }
    const anchor = (event: MouseEvent) => {
      if (!scroller || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!link || link.hasAttribute("target") || link.hasAttribute("download")) return
      const url = new URL(link.href, location.href)
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || !url.hash) return
      let id: string
      try { id = decodeURIComponent(url.hash.slice(1)) } catch { return }
      const target = document.getElementById(id)
      if (!target) return
      event.preventDefault()
      history.pushState(history.state, "", url.hash)
      scroller.scrollTo(target, { onComplete: () => {
        if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
        target.focus({ preventScroll: true })
      } })
    }
    // Capture before a framework link can start its own hash navigation. Until Lenis loads, leave it native.
    document.addEventListener("click", anchor, true)
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
      if (window.__otScrollTo === scrollPageTo) window.__otScrollTo = previousScrollTo
      document.removeEventListener("click", anchor, true)
      events.forEach((event) => removeEventListener(event, start))
      still.removeEventListener("change", stop)
      scroller?.destroy()
      scroller = undefined
    }
  }, [])
  return null
}
