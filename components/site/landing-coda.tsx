"use client"

import * as React from "react"

import { glyphSheet, type Glyph, type GlyphSheet } from "@/components/site/glyph-sheet"
import { Share } from "@/components/site/landing"
import { Cta } from "@/components/site/landing-hero"
import { breath, span, useStage, type Frame } from "@/components/site/stage"
import { advances, alongPath, measure } from "@/components/site/type-shapes"

// The last call: start from zero. A drop in still water, set in type. Rings of fine type stand round the full stop of
// "Start from zero.", each ring one of the page's own sentences, in the page's order from the outside in: the creed,
// what it leaves out, the tune, the one line, the ask, the help, and nearest the drop "Nothing to update. Nothing to
// wrap." So reading inward retells the page, and it ends on the dot. The rings near the drop are small, condensed like
// the wordmark's zero and in ink; further out they open into circles, larger and lighter, and their spacing grows the
// way real ripples spread. Above the line the title stands on they are a step lighter than below it, the eclipse
// poster's softness on one side of a horizon. The title's words lie in the water like stones: the rings break round them.
//
// The scroll plays the drop backwards. As the section comes up, the rings arrive from far out, wide and loosely spaced,
// each being written along its circle as it turns and closes in, tighter and tighter, the outer ones first; last, a ring
// that is the title itself ("start from zero") closes on the centre and shrinks into it, and the full stop lands there,
// the one accent: a sentence collapsing into a single dot. The stop stays put; nothing travels. It is a pure function
// of the scroll, so it plays backwards too. The pointer, or a finger dragged over it, stirs the water: each move drops a
// ripple that runs out through the rings, pushing their letters in and out along their radius and tipping them a
// little, and dies away within a second and a half, when drawing stops. Under reduced motion it is the settled pool.

/** The page's sentences, outside in. On a phone, the ones marked `phone`. */
const RINGS: { text: string; phone?: boolean }[] = [
  { text: "0nlyType is a component library made of type and nothing else.", phone: true },
  { text: "Every control, every sign and every ornament is set in words." },
  { text: "Two typefaces, one accent, a great deal of space.", phone: true },
  { text: "What it leaves out.", phone: true },
  { text: "Each of these does a job that type can do on its own. So each one goes, on purpose." },
  { text: "Kept: words, space and one accent." },
  { text: "One sentence retunes the page.", phone: true },
  { text: "Every italic word is a choice. Change one, and everything follows." },
  { text: "One line.", phone: true },
  { text: "Or ask for it.", phone: true },
  { text: "Help build it.", phone: true },
  { text: "Space does the layout, and type is the only ornament." },
  { text: "Nothing to update. Nothing to wrap.", phone: true },
]
const LAST = "start from zero."

/** One ring at rest: its glyphs as offsets from the centre, each cut once in the ring's ink below the horizon and above it. */
type Ring = {
  below: Glyph[]
  above: Glyph[]
  /** Where on the closing it is written in along its circle: [start, end], 0 to 1. */
  at: [number, number]
  /** How far, and which way, it turns as it closes. */
  turn: number
  dx: Float32Array
  dy: Float32Array
  a: Float32Array
  /** The unit normal at each glyph, for the ripples, and its place in the ring's reading order (0 to 1). */
  nx: Float32Array
  ny: Float32Array
  ord: Float32Array
  last: boolean
}
type Box = { l: number; t: number; r: number; b: number }
type Pool = { cx: number; cy: number; rings: Ring[]; boxes: Box[]; rIn: number; sheet: GlyphSheet }
type Ripple = { x: number; y: number; t0: number; amp: number }

const LIFE = 1400, SPEED = 0.62, WAVE = 40

/** Lays one sentence, repeated to close exactly, round an ellipse of radii rx, ry from angle a0. */
function ring(text: string, font: string, rx: number, ry: number, a0: number) {
  const N = 240, pts = new Float32Array((N + 1) * 2)
  let L = 0
  for (let i = 0; i <= N; i++) {
    const th = a0 + (i / N) * Math.PI * 2
    pts[2 * i] = Math.cos(th) * rx; pts[2 * i + 1] = Math.sin(th) * ry
    if (i) L += Math.hypot(pts[2 * i] - pts[2 * i - 2], pts[2 * i + 1] - pts[2 * i - 1])
  }
  const unit = advances(font, text + "   ")
  const U = unit.reduce((s, q) => s + q.w, 0)
  const n = Math.max(1, Math.round(L / U))
  const glyphs = Array.from({ length: n }, () => unit).flat()
  const gap = Math.max(-0.12 * (U / unit.length), (L * 0.998 - n * U) / glyphs.length)
  return alongPath(pts, glyphs, 0, gap)
}

export function Coda() {
  const pool = React.useRef<HTMLDivElement>(null)
  const stage = React.useRef<HTMLDivElement>(null)
  const title = React.useRef<HTMLHeadingElement>(null)
  const stop = React.useRef<HTMLSpanElement>(null)
  const ripples = React.useRef<Ripple[]>([])
  const last = React.useRef({ x: -1e9, y: -1e9, t: -1e9, scale: -1 })

  const canvas: React.RefObject<HTMLCanvasElement | null> = useStage<Pool | null>(pool, {
    layout(f: Frame): Pool | null {
      const host = stage.current, h2 = title.current, dot = stop.current, cv = canvas.current
      if (!host || !h2 || !dot || !cv) return null
      const css = getComputedStyle(h2), size = parseFloat(css.fontSize)
      const tfont = `${css.fontWeight} ${size}px ${css.fontFamily}`
      const C = cv.getBoundingClientRect(), ox = cv.offsetLeft, oy = cv.offsetTop
      // The full stop, by its offsets in the stage (a transform scales it as it lands, and offsets ignore transforms;
      // the stage is pinned, and offsets inside it ignore that too): its ink's centre from the face's own metrics,
      // since its box is the line, not the dot.
      h2.style.marginInlineStart = ""
      let ex: HTMLElement | null = dot, sx = 0, sy = 0
      while (ex && ex !== host) { sx += ex.offsetLeft; sy += ex.offsetTop; ex = ex.offsetParent as HTMLElement | null }
      const pen = document.createElement("canvas").getContext("2d")!
      pen.font = tfont
      const m = pen.measureText(".")
      // The pool sits in the middle of the window: the title moves along its line until its full stop is centred, as
      // far as its longest line still fits. Right to left keeps the title where the grid sets it.
      if (css.direction !== "rtl") {
        const widest = Math.max(...[...h2.querySelectorAll<HTMLElement>(".coda-line")].map((l) => l.offsetWidth))
        const want = C.width / 2 - (sx + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - ox)
        const shift = Math.round(Math.max(0, Math.min(h2.clientWidth - widest, want)))
        h2.style.marginInlineStart = shift ? `${shift}px` : ""
        sx += shift
      }
      const base = sy + (dot.offsetHeight - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent
      const cx = sx + (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2 - ox
      const cy = base + (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2 - oy
      dot.style.transformOrigin = `${(cx + ox - sx).toFixed(1)}px ${(cy + oy - sy).toFixed(1)}px`
      const dotR = Math.max(m.actualBoundingBoxRight + m.actualBoundingBoxLeft, 4) / 2

      // The stones: every word of the title, by the ink its letters actually have, so the water runs close round them.
      const boxes: Box[] = []
      const walker = document.createTreeWalker(h2, NodeFilter.SHOW_TEXT), range = document.createRange()
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const s = node.textContent ?? ""
        for (const w of s.matchAll(/[^\s.]+/g)) {
          range.setStart(node, w.index); range.setEnd(node, w.index + w[0].length)
          const r = range.getBoundingClientRect(), wm = measure(tfont, w[0])
          const mm = pen.measureText(w[0]), b = r.top - C.top + mm.fontBoundingBoxAscent, pad = size * 0.07
          boxes.push({ l: r.left - C.left - pad, r: r.left - C.left + Math.max(r.width, wm) + pad * 0.6, t: b - mm.actualBoundingBoxAscent - pad, b: b + mm.actualBoundingBoxDescent + pad })
        }
      }

      // The rings: radii from just clear of the stop to the pool's edge, spaced wider outward; condensed like the
      // wordmark's zero near the drop and round further out; small and inked inside, larger and pencilled outside.
      const list = f.phone ? RINGS.filter((r) => r.phone) : RINGS, N = list.length
      const rIn = Math.max(size * 0.62, dotR * 6), rOut = Math.max(rIn * 2.5, Math.min(cy, f.h - cy) - 14)
      const inks = [f.ink.ink, f.ink.graphite, f.ink.pencil]
      const sizeAt = (u: number) => (f.phone ? 6.6 + 3.4 * u : 6.2 + 5 * u)
      // Each gap a little wider than the one inside it, the first a couple of lines of its own type, so the rings
      // fill the pool exactly: the ratio found by halving.
      const g0 = sizeAt(0) * 2.3, need = rOut - rIn, gaps = N - 1
      let lo = 1, hi = 2
      for (let it = 0; it < 40; it++) { const q = (lo + hi) / 2, sum = gaps ? g0 * (Math.pow(q, gaps) - 1) / (q - 1 || 1e-9) : 0; if (sum > need) hi = q; else lo = q }
      const ratio = Math.max(1, lo)
      const rings: Ring[] = [], sheet = glyphSheet(f.dpr)
      for (let i = 0; i < N; i++) {
        const k = N - 1 - i, u = k / Math.max(1, N - 1) // k: 0 nearest the drop
        const r = rIn + (ratio > 1.0001 ? g0 * (Math.pow(ratio, k) - 1) / (ratio - 1) : (need * k) / Math.max(1, gaps))
        const fs = sizeAt(u), wt = Math.round(470 - 150 * u)
        const font = `${wt} ${fs.toFixed(2)}px ${f.ink.voice}`
        const placed = ring(list[i].text, font, r * (0.8 + 0.2 * Math.pow(u, 0.6)), r, -Math.PI / 2 + k * 0.9)
        const lvl = u < 0.28 ? 0 : u < 0.66 ? 1 : 2
        rings.push(pack(placed, sheet, font, inks[lvl], inks[Math.min(2, lvl + 1)], [0.3 * (1 - u), 0.3 * (1 - u) + 0.34], (k % 2 ? 1 : -1) * (0.35 + 0.35 * u), false))
      }
      // The title itself, last, small and in ink, the ring that closes into its own full stop.
      const lf = `500 ${f.phone ? 6.6 : 6.2}px ${f.ink.voice}`
      rings.push(pack(ring(LAST, lf, rIn * 0.42, rIn * 0.5, -Math.PI / 2), sheet, lf, f.ink.ink, f.ink.graphite, [0.38, 0.66], 0.8, true))
      sheet.bake()
      last.current.scale = -1
      return { cx, cy, rings, boxes, rIn, sheet }
    },

    draw(f, pl) {
      if (!pl) return false
      // The closing runs from when the stage is half in until near the end of its pin; settled after, and still.
      const { ctx, now } = f, pin = f.height - f.h, t = f.still ? 1 : span(f.vh - f.top, f.vh * 0.5, f.h + pin * 0.85)

      // A move of the pointer drops a ripple where it is, one every few steps of the hand.
      const R = ripples.current, lp = last.current
      if (!f.still && f.px !== null && f.py !== null && f.since < 80) {
        const d = Math.hypot(f.px - lp.x, f.py - lp.y)
        if (d > 26 || now - lp.t > 160) {
          R.push({ x: f.px, y: f.py, t0: now, amp: Math.min(1, 0.45 + d / 90) })
          lp.x = f.px; lp.y = f.py; lp.t = now
          if (R.length > 6) R.shift()
        }
      }
      while (R.length && now - R[0].t0 > LIFE) R.shift()
      const live = R.map((q) => {
        const age = now - q.t0, fade = 1 - age / LIFE
        return { x: q.x - pl.cx, y: q.y - pl.cy, R: age * SPEED, A: 7 * q.amp * fade * fade }
      })

      // The stop lands as the last ring closes into it: from nothing, a small rebound, then still.
      const land = span(t, 0.8, 0.97), scale = land < 0.7 ? (land / 0.7) * 1.08 : 1.08 - 0.08 * ((land - 0.7) / 0.3)
      if (Math.abs(scale - lp.scale) > 1e-3 && stop.current) {
        stop.current.style.setProperty("--coda-stop", scale.toFixed(3))
        lp.scale = scale
      }

      const m = ctx.getTransform(), k = m.a, boxes = pl.boxes
      // The whole pool closes as one, so no ring ever crosses another: wide and loose, then tighter and tighter.
      const close = breath(span(t, 0, 0.7)), field = 1 + 1.4 * (1 - close)
      for (const rg of pl.rings) {
        let s = field, gs = 1, turn = rg.turn * (1 - close)
        const show = span(t, rg.at[0], rg.at[1])
        if (rg.last) {
          // In with the others, then shrinking, letters and all, into the stop.
          const c = breath(span(t, 0.72, 0.95))
          if (c >= 0.995) continue
          s *= 1 - c; gs = Math.min(1, Math.pow(1 - c, 0.7)); turn += c * 2.2
        }
        if (show <= 0.002) continue
        const ct = Math.cos(turn), st = Math.sin(turn)
        const n = rg.dx.length
        for (let i = 0; i < n; i++) {
          if (rg.ord[i] > show) continue
          let x = (rg.dx[i] * ct - rg.dy[i] * st) * s, y = (rg.dx[i] * st + rg.dy[i] * ct) * s, a = rg.a[i] + turn
          if (live.length) {
            const nx = rg.nx[i] * ct - rg.ny[i] * st, ny = rg.nx[i] * st + rg.ny[i] * ct
            let push = 0
            for (const q of live) {
              const u = Math.hypot(x - q.x, y - q.y) - q.R
              if (u > -WAVE * 2.2 && u < WAVE * 2.2) push += q.A * Math.sin((u / WAVE) * Math.PI * 2) * Math.exp(-(u * u) / (WAVE * WAVE * 1.4))
            }
            x += nx * push; y += ny * push; a += push * 0.035
          }
          const X = x + pl.cx, Y = y + pl.cy
          let hidden = false
          for (const b of boxes) if (X > b.l && X < b.r && Y > b.t && Y < b.b) { hidden = true; break }
          if (hidden || X < -20 || X > f.w + 20 || Y < -20 || Y > f.h + 20) continue
          const c = Math.cos(a) * gs * k, sn = Math.sin(a) * gs * k
          ctx.setTransform(c, sn, -sn, c, k * X + m.e, k * Y + m.f)
          pl.sheet.draw(ctx, y < 0 ? rg.above[i] : rg.below[i])
        }
      }
      ctx.setTransform(m)
      return live.length > 0
    },
  })

  // A finger dragged over the water scrolls the page, and the browser takes the pointer for that: the touches still
  // reach here, so each drops its ripple too, and the scroll it makes asks for the frame.
  React.useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const onTouch = (e: TouchEvent) => {
      const tt = e.touches[0], r = cv.getBoundingClientRect(), lp = last.current, now = performance.now()
      if (!tt || matchMedia("(prefers-reduced-motion: reduce)").matches) return
      const x = tt.clientX - r.left, y = tt.clientY - r.top, d = Math.hypot(x - lp.x, y - lp.y)
      if (d < 26 && now - lp.t < 160) return
      ripples.current.push({ x, y, t0: now, amp: Math.min(1, 0.45 + d / 90) })
      if (ripples.current.length > 6) ripples.current.shift()
      lp.x = x; lp.y = y; lp.t = now
    }
    cv.addEventListener("touchstart", onTouch, { passive: true })
    cv.addEventListener("touchmove", onTouch, { passive: true })
    return () => {
      cv.removeEventListener("touchstart", onTouch)
      cv.removeEventListener("touchmove", onTouch)
    }
  }, [canvas])

  return (
    <section className="coda" aria-labelledby="coda-title">
      <div className="coda-pool" ref={pool}>
        <div className="coda-stage" ref={stage}>
          <canvas className="coda-rings" ref={canvas} aria-hidden="true" />
          <h2 className="coda-title" id="coda-title" ref={title}>
            <span className="coda-line">Start from </span>
            <span className="coda-line">
              zero<span className="coda-stop" ref={stop}>.</span>
            </span>
          </h2>
        </div>
      </div>
      <div className="coda-actions">
        <Cta href="/docs/">Read the docs</Cta>
        <Share url="/" title="0nlyType: React components, set in type">
          Share 0nlyType
        </Share>
      </div>
      <p className="coda-licence">Free to use and change: MIT licensed, with typefaces under the SIL Open Font Licence.</p>
    </section>
  )
}

/** Packs placed glyphs into typed arrays, as offsets from the centre with the outward normal and reading order. */
function pack(placed: ReturnType<typeof alongPath>, sheet: GlyphSheet, font: string, below: string, above: string, at: [number, number], turn: number, lastRing: boolean): Ring {
  const n = placed.length
  const dx = new Float32Array(n), dy = new Float32Array(n), a = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n), ord = new Float32Array(n)
  placed.forEach((q, i) => {
    dx[i] = q.x; dy[i] = q.y; a[i] = q.a
    nx[i] = Math.sin(q.a); ny[i] = -Math.cos(q.a)
    ord[i] = (i + 0.5) / n
  })
  return { below: placed.map((q) => sheet.glyph(font, below, q.g, "middle")), above: placed.map((q) => sheet.glyph(font, above, q.g, "middle")), at, turn, dx, dy, a, nx, ny, ord, last: lastRing }
}
