"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { ReadingTrail, type TrailSection } from "@/registry/0nlytype/ui/reading-trail"
import { afterOverture } from "@/lib/site/overture.mjs"

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

// The sections are whatever the page has marked, read from the document after each commit: a string, so React can tell when it changed.
const read = () =>
  JSON.stringify(
    [...document.querySelectorAll<HTMLElement>("[data-rail][id]")].map((s, i) => ({ id: s.id, num: s.dataset.railNum ?? ROMAN[i] ?? String(i + 1), name: s.dataset.rail! })),
  )
const never = () => () => {}

/**
 * The page's reading trail, once, for every route: the scrollbar at the window's edge with the section you are in
 * running down beside it, and the page's contents for the keyboard. Any element with an id and data-rail="Name"
 * becomes a section, numbered in order unless it says its own (data-rail-num).
 */
export function PageRail() {
  const path = usePathname() // a new page renders this again, and the sections are read again with it
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => afterOverture(() => setReady(true)), [])
  const sections = React.useSyncExternalStore(never, () => read(), () => "[]") // (a fresh function each time, so React looks again after the commit)
  // The landing's rail is decoration until someone scrolls; its observers must not compete with Skip intro.
  if (path === "/" && !ready) return null
  return <ReadingTrail variant="rail" className="page-rail" sections={JSON.parse(sections) as TrailSection[]} />
}
