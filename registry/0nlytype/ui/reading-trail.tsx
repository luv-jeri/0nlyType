"use client"

import * as React from "react"

import { useComposedRefs } from "@/registry/0nlytype/lib/refs"
import { cn } from "@/registry/0nlytype/lib/utils"
import { Item, ItemActions, ItemContent, ItemGroup, ItemTitle } from "@/registry/0nlytype/ui/item"
import { Scrollbar } from "@/registry/0nlytype/ui/scrollbar"

type TrailSection = {
  /** The id of the element the section begins at. */
  id: string
  name: string
  /** Its number on the trail. Defaults to its place: 01, 02. */
  num?: string
}

type ReadingTrailProps = Omit<React.ComponentProps<"nav">, "children"> & {
  sections: TrailSection[]
  /**
   * contents: the page's contents, set as a contents page: each section's number and name, a dotted leader, and
   * where on the page it is reached (00 to 100); the leader of the one you are in inks as you read it. rail: the page's
   * scrollbar at the window's edge, with the section you are in running down the rail beside it like the title on a
   * book's spine; the contents stay for the keyboard and come out beside the rail when focus reaches them.
   */
  variant?: "contents" | "rail"
  /** Names the trail for assistive technology, and heads the contents. */
  label?: string
  /** Pins where you are instead of reading the page, for documentation: the section's place and how much of it is read (0 to 1). */
  pinned?: { now: number; read?: number }
}

const two = (n: number) => String(n).padStart(2, "0")
const clamp = (v: number) => Math.min(1, Math.max(0, v))

/**
 * Where on the page (0 to 1 of the way down) each section is reached: when its top meets the middle of the window,
 * as the scrollbar marks it. Those too near the end to reach the middle share the last stretch, so each still
 * has its turn before the page ends.
 */
function reaches(tops: number[], max: number) {
  const half = innerHeight / 2
  const r = tops.map((t) => clamp((t - half) / max))
  const k = r.findIndex((v) => v >= 1)
  if (k >= 0) {
    const a = k > 0 ? r[k - 1] : 0, t = r.length - k
    for (let j = 0; j < t; j++) r[k + j] = a + ((1 - a) * (j + 1)) / t
  }
  return r
}

type Place = { now: number; folios: number[] }

/**
 * A trail through a long page: its sections by number and name, the one you are in carrying the accent, and a dotted
 * leader that inks as you read it. Reads the window's scroll; links are the page's own anchors.
 */
function ReadingTrail({ sections, variant = "contents", label = "On this page", pinned, className, style, ref: forwardedRef, ...props }: ReadingTrailProps) {
  const key = JSON.stringify(sections.map((s) => s.id))
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  const composedRef = useComposedRefs(setEl, forwardedRef)
  const [place, setPlace] = React.useState<Place>({ now: pinned?.now ?? -1, folios: [] })
  // The spine's head turns only when you move it, never on arrival.
  const [turned, setTurned] = React.useState(false)

  React.useEffect(() => {
    if (!el || pinned) return
    const ids = JSON.parse(key) as string[]
    // The sections' places are read when the layout can change (a resize, the fonts arriving); a scroll only moves
    // where you are among them, from the offset the scroll event read while the page was still laid out. Scrolling
    // reads no layout, and the trail re-renders only when the section you're in changes.
    let frame = 0, dirty = true, last = -2, y = scrollY, max = 0, read = "", placed = ""
    let r: number[] = []
    const update = () => {
      const p = max < 1 ? 0 : clamp(y / max)
      let now = -1
      r.forEach((v, i) => { if (v <= p + 1e-4) now = i })
      const end = r[now + 1] ?? 1
      const share = now < 0 ? "0" : end > r[now] ? clamp((p - r[now]) / (end - r[now])).toFixed(3) : "1"
      if (share !== read) el.style.setProperty("--ot-trail-read", (read = share))
      const folios = r.map((v) => Math.round(v * 100))
      if (last !== -2 && last !== now) setTurned(true)
      last = now
      const k = `${now}:${folios.join()}`
      if (k !== placed) {
        placed = k
        setPlace({ now, folios })
      }
    }
    const measure = () => {
      const doc = document.documentElement
      y = scrollY
      max = doc.scrollHeight - innerHeight
      const tops = ids.map((id) => {
        const s = document.getElementById(id)
        return s ? s.getBoundingClientRect().top + y : Infinity
      })
      r = max < 1 ? ids.map((_, i) => (i ? 1 : 0)) : reaches(tops, max)
      update()
    }
    const run = () => {
      frame = 0
      if (!dirty) return update()
      dirty = false
      measure()
    }
    const soon = () => {
      dirty = true
      if (!frame) frame = requestAnimationFrame(run)
    }
    const onScroll = () => {
      y = scrollY
      if (!frame) frame = requestAnimationFrame(run)
    }
    const resize = new ResizeObserver(soon)
    resize.observe(document.body)
    addEventListener("scroll", onScroll, { passive: true })
    addEventListener("resize", soon)
    document.fonts?.ready.then(soon)
    dirty = false
    measure()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      removeEventListener("scroll", onScroll)
      removeEventListener("resize", soon)
    }
  }, [el, key, pinned])

  const now = pinned ? pinned.now : place.now
  // Pinned, the sections are spread evenly down the page.
  const folios = pinned ? sections.map((_, i) => Math.round((i / sections.length) * 100)) : place.folios
  const numOf = (s: TrailSection, i: number) => s.num ?? two(i + 1)
  const head = sections[now]
  const rail = variant === "rail"

  // With no sections there is nothing to name: the rail alone, not an empty landmark.
  const Root = sections.length ? "nav" : "div"
  return (
    <Root
      ref={composedRef}
      data-slot="reading-trail"
      data-variant={variant}
      aria-label={sections.length ? label : undefined}
      className={cn("ot-trail", className)}
      style={pinned ? ({ "--ot-trail-read": pinned.read ?? 0, ...style } as React.CSSProperties) : style}
      {...props}
    >
      {!rail && sections.length > 0 && <p className="ot-trail-caption" aria-hidden="true">{label}</p>}
      {sections.length > 0 && <ItemGroup className="ot-trail-list">
        {sections.map((s, i) => (
          <Item key={s.id} data-slot="reading-trail-step" data-state={i < now ? "read" : i === now ? "now" : "ahead"} className="ot-trail-step">
            <ItemContent>
              <ItemTitle>
                <a href={`#${s.id}`} className="ot-trail-link" aria-current={i === now ? "location" : undefined}>
                  <span className="ot-trail-num">{numOf(s, i)}</span>
                  <span className="ot-trail-name">{s.name}</span>
                </a>
              </ItemTitle>
            </ItemContent>
            <ItemActions aria-hidden="true">{folios[i] === undefined ? "" : two(folios[i])}</ItemActions>
          </Item>
        ))}
      </ItemGroup>}
      {rail && head && (
        <p className="ot-trail-head" aria-hidden="true">
          <span key={now} className="ot-trail-head-in" data-turn={turned || undefined}>
            <span className="ot-trail-num">{numOf(head, now)}</span>
            <span dir="auto">{head.name}</span>
          </span>
        </p>
      )}
      {rail && <Scrollbar variant="page" sections={sections.map((s, i) => ({ id: s.id, num: numOf(s, i), name: s.name }))} />}
    </Root>
  )
}

export { ReadingTrail, type ReadingTrailProps, type TrailSection }
