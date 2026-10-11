"use client"

import * as React from "react"

import { afterOverture, onOvertureEnd, overtureActive, overtureLeft } from "@/components/site/landing-overture"

// One canvas that a section draws its type on, answering only the scroll, the pointer and the theme. The stage owns
// what every section would otherwise repeat: the canvas's size at the screen's density, drawing only while on screen,
// how far the scroll has carried the section, where the pointer is and how long since it moved, reduced motion, and the
// inks and faces of the page as it is tuned now. A scene lays its type out once (layout, with pretext, when the size,
// the theme or the fonts change) and draws a frame from it (draw). Nothing moves by itself: a frame is asked for only
// by a scroll, a pointer, a resize or a retune, and the loop keeps running only while draw says something still moves.
// Focus coming to or leaving the host asks for a frame too, so a scene can answer the keyboard as it does the pointer.

type Lib = typeof import("@chenglou/pretext")

export type Inks = { ink: string; graphite: string; pencil: string; rule: string; paper: string; accent: string; voice: string; expression: string }

export type Frame = {
  ctx: CanvasRenderingContext2D
  /** The canvas's size in CSS pixels; the context is already scaled to them. */
  w: number
  h: number
  dpr: number
  /** How far the scroll has carried the host: 0 when its top meets the window's bottom, 1 when its bottom meets the window's top. 1 under reduced motion. */
  p: number
  /** The host's top and height relative to the window, in CSS pixels, read once per frame. */
  top: number
  height: number
  vh: number
  /** The pointer over the canvas in CSS pixels, or null when it has left; ms since it last moved. */
  px: number | null
  py: number | null
  since: number
  /** The time of this frame, ms. */
  now: number
  /** Reduced motion: draw the settled state, and no ripples. */
  still: boolean
  phone: boolean
  ink: Inks
  lib: Lib
}

export type Scene<L> = {
  /** Sets the type for this size, theme and face. Runs again on resize, retune and font arrival, never per frame. */
  layout: (f: Frame) => L | Promise<L>
  /** Draws one frame. Returns true while something still moves (a ripple settling), so the next frame is asked for. */
  draw: (f: Frame, laid: L) => boolean
}

const THEME = ["data-scheme", "data-pair", "data-key", "data-mode"]

function readInks(): Inks {
  const css = getComputedStyle(document.documentElement), v = (n: string) => css.getPropertyValue(n).trim()
  return {
    ink: v("--ot-ink"), graphite: v("--ot-graphite"), pencil: v("--ot-pencil"), rule: v("--ot-rule"), paper: v("--ot-paper"),
    accent: v("--ot-accent"), voice: v("--ot-voice"), expression: v("--ot-expression"),
  }
}

// Stages far from the window wait their turn to lay out, one at an idle moment each. Laid out together, as every
// stage on the page woke at once when pretext arrived, they held the main thread for most of a second on a slow
// machine, through the overture and the keys meant to end it. A stage near the window does not wait.
const waiting: (() => void)[] = []
let pumping = false
const later = (go: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 60))
function pump() {
  if (pumping || !waiting.length) return
  pumping = true
  // Not while the overture plays: the keys and the click that end it come first. It ends by its deadline however it ends.
  if (overtureActive()) {
    const go = () => { off(); clearTimeout(t); pumping = false; pump() }
    const off = onOvertureEnd(go), t = setTimeout(go, overtureLeft() + 100)
    return
  }
  later(() => {
    pumping = false
    waiting.shift()?.()
    pump()
  })
}

/** Draws `scene` on the canvas the returned ref is given, sized to its CSS box, carried by the scroll of `host`. */
export function useStage<L>(host: React.RefObject<HTMLElement | null>, scene: Scene<L>) {
  const canvas = React.useRef<HTMLCanvasElement | null>(null)
  const sceneRef = React.useRef(scene)
  React.useEffect(() => {
    sceneRef.current = scene
  })

  React.useEffect(() => {
    const cv = canvas.current, el = host.current
    if (!cv || !el) return
    const ctx = cv.getContext("2d")
    if (!ctx) return
    const motion = matchMedia("(prefers-reduced-motion: reduce)"), narrow = matchMedia("(max-width: 760px)")
    let lib: Lib | null = null, laid: L | null = null, ink = readInks(), w = 0, h = 0, dpr = 1
    let seen = false, near = false, raf = 0, alive = true, gen = 0
    let hurry: (() => void) | null = null
    let px: number | null = null, py: number | null = null, moved = -1e9

    const frame = (now: number): Frame => {
      const r = el.getBoundingClientRect(), vh = innerHeight, still = motion.matches
      const p = still ? 1 : Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)))
      return { ctx, w, h, dpr, p, top: r.top, height: r.height, vh, px: still ? null : px, py: still ? null : py, since: now - moved, now, still, phone: narrow.matches, ink, lib: lib! }
    }
    const tick = (now: number) => {
      raf = 0
      if (!alive || !seen || !lib || laid === null) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (sceneRef.current.draw(frame(now), laid)) wake()
    }
    const wake = () => {
      if (!raf && alive && seen && laid !== null && !overtureActive()) raf = requestAnimationFrame(tick)
    }
    // Sets the type again. A newer call wins over a slower older one, so a quick retune never paints stale letters.
    const relayout = async () => {
      if (overtureActive()) return
      const mine = ++gen
      await document.fonts.ready
      if (!lib) lib = await import("@chenglou/pretext")
      if (!alive || mine !== gen || overtureActive()) return
      if (!near) {
        await new Promise<void>((go) => {
          const turn = () => { hurry = null; go() }
          hurry = () => { const i = waiting.indexOf(turn); if (i >= 0) waiting.splice(i, 1); turn() }
          waiting.push(turn)
          pump()
        })
        if (!alive || mine !== gen) return
      }
      const box = cv.getBoundingClientRect()
      dpr = Math.min(2, devicePixelRatio || 1)
      w = Math.max(1, Math.round(box.width)); h = Math.max(1, Math.round(box.height))
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ink = readInks()
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const next = await sceneRef.current.layout(frame(performance.now()))
      if (!alive || mine !== gen) return
      laid = next
      wake()
    }

    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting
      if (seen) wake()
    }, { rootMargin: "100px 0px" })
    io.observe(cv)
    // Within a window's height of the screen, a stage waiting its turn is set at once.
    const nearIo = new IntersectionObserver(([e]) => {
      near = e.isIntersecting
      if (near && !overtureActive()) hurry?.()
    }, { rootMargin: "100% 0px" })
    nearIo.observe(cv)
    const ro = new ResizeObserver(() => void relayout())
    ro.observe(cv)
    const mo = new MutationObserver(() => requestAnimationFrame(() => void relayout()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: THEME })
    const onScroll = () => wake()
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect()
      px = e.clientX - r.left; py = e.clientY - r.top; moved = performance.now()
      wake()
    }
    const onLeave = () => {
      px = py = null
      wake()
    }
    const onMotion = () => void relayout()
    const onFocus = () => wake()
    addEventListener("scroll", onScroll, { passive: true })
    cv.addEventListener("pointermove", onMove, { passive: true })
    cv.addEventListener("pointerdown", onMove, { passive: true })
    cv.addEventListener("pointerleave", onLeave)
    motion.addEventListener("change", onMotion)
    el.addEventListener("focusin", onFocus)
    el.addEventListener("focusout", onFocus)
    const offOverture = afterOverture(() => void relayout())
    return () => {
      alive = false
      offOverture()
      cancelAnimationFrame(raf)
      io.disconnect(); nearIo.disconnect(); ro.disconnect(); mo.disconnect()
      hurry?.()
      removeEventListener("scroll", onScroll)
      cv.removeEventListener("pointermove", onMove)
      cv.removeEventListener("pointerdown", onMove)
      cv.removeEventListener("pointerleave", onLeave)
      motion.removeEventListener("change", onMotion)
      el.removeEventListener("focusin", onFocus)
      el.removeEventListener("focusout", onFocus)
    }
  }, [host])
  return canvas
}

/** Eases a value from 0 to 1 over [a, b] of a progress, clamped. */
export const span = (p: number, a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)))
/** The page's breath, as a function: slow out of rest, slow into it. */
export const breath = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
