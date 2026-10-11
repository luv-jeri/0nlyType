"use client"

import * as React from "react"

import { cn } from "@/registry/0nlytype/lib/utils"
import { roll } from "@/registry/0nlytype/lib/roll"

const Slide = React.createContext({ index: 0, total: 0, current: false, shelf: false, choose: () => {} })

const pad = (n: number) => String(n).padStart(2, "0")

type CarouselProps = React.ComponentProps<"div"> & {
  /**
   * poster: one slide at a time, the name sinking under a hairline.
   * line: every name on one line of type, read along; the one at the start inks and takes the accent full stop.
   * shelf: the slides stand as spines, their names running up them; the one you take out faces you.
   */
  variant?: "poster" | "line" | "shelf"
  /** Names the slides for the keyboard: the track takes focus, so it needs a name. */
  trackLabel?: string
  previousLabel?: string
  nextLabel?: string
}

/**
 * One slide at a time. The count between the arrows rolls the way you travel.
 * Swipe, scroll, use the arrows, or focus the track and press the arrow keys.
 * Slides are CarouselItems, as direct children.
 */
function Carousel({ variant = "poster", trackLabel = "Slides", previousLabel = "Previous", nextLabel = "Next", className, children, ...props }: CarouselProps) {
  const track = React.useRef<HTMLDivElement>(null)
  const now = React.useRef<HTMLSpanElement>(null)
  const items = React.Children.toArray(children)
  const total = items.length
  const shelf = variant === "shelf"
  const [at, setAt] = React.useState(0)
  const [shown, setShown] = React.useState(0)
  const was = React.useRef(0)

  const settle = React.useCallback((i: number) => {
    if (i === was.current) return
    const dir = i > was.current ? 1 : -1
    was.current = i
    setAt(i)
    if (now.current) roll(now.current, () => setShown(i), "0.6em", dir)
    else setShown(i)
  }, [])

  // The slide whose start edge is nearest the track's start is the one you're on, while you swipe or scroll.
  React.useEffect(() => {
    const t = track.current
    if (!t || shelf) return
    let frame = 0
    const read = () => {
      frame = 0
      const side = getComputedStyle(t).direction === "rtl" ? "right" : "left"
      const edge = t.getBoundingClientRect()[side]
      let best = 0
      let near = Infinity
      ;[...t.children].forEach((c, i) => {
        const d = Math.abs(c.getBoundingClientRect()[side] - edge)
        if (d < near) [near, best] = [d, i]
      })
      settle(best)
    }
    const onScroll = () => void (frame ||= requestAnimationFrame(read))
    t.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      t.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(frame)
    }
  }, [total, shelf, settle])

  const go = (i: number) => {
    const to = Math.max(0, Math.min(total - 1, i))
    // The shelf doesn't scroll: taking a spine out is the move.
    if (shelf) return settle(to)
    track.current?.children[to]?.scrollIntoView({ inline: "start", block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })
  }

  return (
    <div data-slot="carousel" data-variant={variant} role="region" aria-roledescription="carousel" className={cn("ot-carousel", className)} {...props}>
      <div
        ref={track}
        data-slot="carousel-track"
        tabIndex={0}
        aria-label={trackLabel}
        className="ot-carousel-track"
        onKeyDown={(e) => {
          const target = e.target as HTMLElement
          if (e.defaultPrevented || (target !== e.currentTarget && (target.isContentEditable || target.closest("input, textarea, select")))) return
          const rtl = getComputedStyle(e.currentTarget).direction === "rtl"
          const to = { ArrowLeft: at + (rtl ? 1 : -1), ArrowRight: at + (rtl ? -1 : 1), Home: 0, End: total - 1 }[e.key]
          if (to === undefined) return
          e.preventDefault()
          go(to)
        }}
      >
        {items.map((item, index) => (
          <Slide.Provider key={index} value={{ index, total, current: index === at, shelf, choose: () => go(index) }}>
            {item}
          </Slide.Provider>
        ))}
      </div>
      <div data-slot="carousel-nav" className="ot-carousel-nav">
        <button type="button" data-slot="carousel-previous" className="ot-carousel-arrow" aria-label={previousLabel} disabled={at === 0} onClick={() => go(at - 1)}>
          ←
        </button>
        <span data-slot="carousel-count" className="ot-carousel-count" aria-live="polite" aria-atomic="true">
          <span ref={now} className="ot-carousel-now">{pad(shown + 1)}</span> / {pad(total)}
        </span>
        <button type="button" data-slot="carousel-next" className="ot-carousel-arrow" aria-label={nextLabel} disabled={at >= total - 1} onClick={() => go(at + 1)}>
          →
        </button>
      </div>
    </div>
  )
}

function CarouselItem({ className, children, ...props }: React.ComponentProps<"div">) {
  const { index, total, current, shelf, choose } = React.useContext(Slide)
  return (
    <div
      data-slot="carousel-item"
      data-current={current ? "" : undefined}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}`}
      className={cn("ot-carousel-slide", className)}
      {...props}
    >
      {children}
      {/* A spine on the shelf is taken out with a click; the keyboard has the track's arrows and the buttons. */}
      {shelf && !current ? <button type="button" tabIndex={-1} className="ot-carousel-spine" aria-label={`Show ${index + 1} of ${total}`} onClick={choose} /> : null}
    </div>
  )
}

/** A name set so large the frame crops it. */
function CarouselTitle({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="carousel-title" className={cn("ot-carousel-title", className)} {...props} />
}

export { Carousel, CarouselItem, CarouselTitle, type CarouselProps }
