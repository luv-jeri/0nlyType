"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { ThemeControls } from "@/components/site/theme-controls"
import { Search, type SearchGroup } from "@/components/site/search"
import { tempo } from "@/lib/site/tempo"
import { FeedbackLink } from "@/components/site/reporting/launcher"
import { Lockup } from "@/components/site/wordmark"

type Place = { num: string; name: string }

/** The fixed row: the mark, where you are (it rolls when that changes), search and the theme. */
export function TopRow({ places, groups }: { places: Record<string, Place>; groups: SearchGroup[] }) {
  const path = usePathname()
  const place = places[path] ?? places[path + "/"] ?? { num: "", name: "" }
  const now = React.useRef<HTMLParagraphElement>(null)
  const last = React.useRef(place.name)

  // The words change with the page; this only rolls them in from the side you're heading.
  React.useEffect(() => {
    const el = now.current
    if (!el || last.current === place.name) return
    const order = Object.values(places).map((p) => p.name)
    const dir = order.indexOf(place.name) >= order.indexOf(last.current) ? 1 : -1
    last.current = place.name
    el.animate([{ translate: `0 ${0.7 * dir}em`, opacity: 0 }, { translate: "0 0", opacity: 1 }], { duration: tempo("--ot-moderato", el), easing: "cubic-bezier(.16,1,.3,1)" })
  }, [place.name, places])

  return (
    <header className="bar">
      <Link className="bar-mark" href="/" prefetch={false} aria-label="0nlyType, home">
        {/* 2.75rem tall, the creed would be set at half a pixel: grain, and 150 lines of text every page restyles. Its bands stay. */}
        <Lockup written={false} />
      </Link>
      <p className="bar-now" ref={now} aria-live="polite">
        <span className="bar-num">{place.num}</span> <span>{place.name}</span>
      </p>
      <div className="bar-end">
        <a className="ot-link ot-report-entry bar-star" href="https://github.com/luv-jeri/0nlyType">Star on GitHub</a>
        {/* Its one rule travels with it: the row is too narrow for it on a phone, where the page asks instead. */}
        <style href="bar-star" precedence="default">{"@media (max-width: 700px) { .bar-star { display: none } }"}</style>
        <FeedbackLink />
        <Search groups={groups} />
        <ThemeControls />
      </div>
    </header>
  )
}
