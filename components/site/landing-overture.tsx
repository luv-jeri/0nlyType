"use client"

import { OVERTURE_ATTR, OVERTURE_DEADLINE, OVERTURE_END_EVENT, OVERTURE_SCRIPT } from "@/lib/site/overture.mjs"
import { Button } from "@/registry/0nlytype/ui/button"

// The home overture, seen from React. The clock is not here: a script in the hero's HTML (lib/site/overture.mjs)
// decides on a browser's first visit, sets data-overture-at on <html>, and ends the overture itself (at the deadline,
// on the person's first move, or from Skip intro), whether or not React ever loads. The hands' settle and the dot's
// light (landing.css) play only while that attribute is there; the zero listens here for how much of it is left.
// Nothing here is stored: the choice to play was made, and recorded, before the first paint.

export type OvertureEnd = "deadline" | "skip" | "input" | "motion"

export const overtureActive = () => typeof document !== "undefined" && document.documentElement.hasAttribute(OVERTURE_ATTR)

/** Milliseconds left before the deadline, counted from when the overture began. */
export function overtureLeft() {
  const at = Number(document.documentElement.getAttribute(OVERTURE_ATTR))
  return Number.isFinite(at) ? Math.max(0, OVERTURE_DEADLINE - (performance.now() - at)) : 0
}

/** Tells you when the overture ends, however it ends. Returns the way to stop listening. */
export function onOvertureEnd(fn: (why: OvertureEnd) => void) {
  const listen = (e: Event) => fn((e as CustomEvent<OvertureEnd>).detail)
  document.addEventListener(OVERTURE_END_EVENT, listen)
  return () => document.removeEventListener(OVERTURE_END_EVENT, listen)
}

/**
 * The visible way out. Always in the HTML and shown by CSS only while the overture plays, so it is a real control for
 * the whole of the intro and costs nothing after it. The script's own delegated click listener is what ends the
 * overture, so it works before hydration too.
 */
export function Overture() {
  return (
    <Button variant="bracket" type="button" className="hero-skip">
      Skip intro
    </Button>
  )
}

/**
 * The decision and the clock, as a script in the page's HTML so they run before the hero paints. It is the pattern
 * Next's guide gives for client-only state: a real script on the server, inert text once React renders it in the
 * browser (so a client-side visit to the home page, which never runs it, does not warn).
 */
export function OvertureScript() {
  return <script type={typeof window === "undefined" ? "text/javascript" : "text/plain"} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: OVERTURE_SCRIPT }} />
}
