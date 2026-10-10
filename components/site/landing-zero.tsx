"use client"

import { registryURL } from "@/lib/site/config.mjs"
import { OVERTURE_DEADLINE } from "@/lib/site/overture.mjs"
import NextLink from "next/link"
import * as React from "react"

import { CopyCommand } from "@/components/site/landing"
import { Cta } from "@/components/site/landing-hero"
import { Overture, OvertureScript, onOvertureEnd, overtureActive, overtureLeft } from "@/components/site/landing-overture"
import { area, decodeHands, drawHand, extent, setHand, type Hand, type Place, type Touch } from "@/components/site/hands"
import { Wordmark } from "@/components/site/wordmark"

// The hero and 01, the pieces, on one sticky stage turned by the scroll. Michelangelo's two hands, set in real letters,
// reach toward a zero made of every piece's name: Adam's hand is what you ask for, in the italic; God's is what we hand
// back, a line for every piece, in roman. Every letter takes its weight and ink from the fresco's light where it sits,
// so the fingers read (components/site/hands.ts). Scroll, and the hands step back, the zero moves aside and becomes a
// dial, and the dial turns, one piece per notch, with a settled spring. Point at a name to read it; click it, or use the
// arrow keys in the list, to turn to it. Point at a hand and a loupe follows over its letters, the phrase under it is
// read out in full ink, and the hands lean in as you near the zero; a line of God's hand names its piece in the zero,
// and clicking it turns there.
//
// Everything the scroll moves is written, never read: positions are measured once per layout (on resize, when the
// fonts arrive, when the pair changes), and the scroll handler reads only scrollY, before any frame writes. Each
// value is written only where it is read, and only when it changes. Screen readers and keyboards get
// the index as a real list of links; the drawing is aria-hidden and captioned under the zero.

export type Piece = { name: string; title: string; summary: string }
export type Movement = { num: string; name: string; pieces: Piece[] }

type Flat = Piece & { mv: Movement; i: number }
type Arc = { m: Movement; start: number; end: number; count: number; path: SVGPathElement; t1: SVGLineElement; t2: SVGLineElement; label: SVGTextElement; rest: SVGTSpanElement }
type Shape = { cx: number; cy: number; ryo: number; rxo: number; ryi: number; rxi: number }
type Geometry = { W: number; H: number; m: number; phone: boolean; narrow: boolean; hero: Shape; dial: Shape; room: [number, number]; cap: number }
type Tab = { ls: Float64Array; L: number; steps: number }

const NS = "http://www.w3.org/2000/svg"
const TAU = Math.PI * 2
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smooth = (t: number) => t * t * (3 - 2 * t)
const mod = (a: number, n: number) => ((a % n) + n) % n
const pad3 = (n: number) => String(n).padStart(3, "0")
const install = (name: string) => `npx shadcn@latest add ${registryURL(name)}`
const shape = (ryo: number) => ({ ryo, rxo: 0.76 * ryo, ryi: 0.83 * ryo, rxi: 0.43 * ryo })
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> | null, parent?: Element) => {
  const e = document.createElementNS(NS, tag)
  if (attrs) for (const k in attrs) e.setAttribute(k, String(attrs[k]))
  if (parent) parent.appendChild(e)
  return e
}
// Arc length along an ellipse, so names sit evenly however stretched the zero is.
function arcTable(rx: number, ry: number, steps = 720): Tab {
  const ls = new Float64Array(steps + 1)
  let L = 0, px = rx, py = 0
  for (let k = 1; k <= steps; k++) {
    const t = (k / steps) * TAU, x = rx * Math.cos(t), y = ry * Math.sin(t)
    L += Math.hypot(x - px, y - py)
    px = x
    py = y
    ls[k] = L
  }
  return { ls, L, steps }
}
function tAt(tab: Tab, f: number) {
  const target = mod(f, 1) * tab.L, ls = tab.ls
  let lo = 0, hi = tab.steps
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (ls[mid] < target) lo = mid
    else hi = mid
  }
  const span = ls[hi] - ls[lo] || 1
  return ((lo + (target - ls[lo]) / span) / tab.steps) * TAU
}
function fAt(tab: Tab, t: number) {
  const x = (mod(t, TAU) / TAU) * tab.steps, k = Math.floor(x), r = x - k
  const a = tab.ls[k], b = tab.ls[Math.min(k + 1, tab.steps)]
  return (a + (b - a) * r) / tab.L
}

const ASKS = ["a pricing page", "a sign-up form", "a settings screen", "an empty state", "a changelog", "a booking calendar", "a command menu", "a data table", "a page for when nothing is found", "a checkout", "a profile page", "a dashboard", "an onboarding letter", "a search page"]

export function LandingZero({ movements, count }: { movements: Movement[]; count: number }) {
  const pieces = React.useMemo<Flat[]>(() => {
    let i = 0
    return movements.flatMap((mv) => mv.pieces.map((p) => ({ ...p, mv, i: i++ })))
  }, [movements])
  const N = pieces.length
  const [sel, setSel] = React.useState(0)
  const [active, setActive] = React.useState(0)
  const [keys, setKeys] = React.useState(false)

  const section = React.useRef<HTMLElement>(null)
  const stage = React.useRef<HTMLDivElement>(null)
  const ring = React.useRef<SVGSVGElement>(null)
  const hands = React.useRef<HTMLDivElement>(null)
  const band = React.useRef<HTMLDivElement>(null)
  const notes = React.useRef<HTMLDivElement>(null)
  const part = React.useRef<HTMLDivElement>(null)
  const list = React.useRef<HTMLOListElement>(null)
  // The engine's two doors for React: turn to a piece, and say where the scroll stands.
  const api = React.useRef<{ turnTo: (i: number) => void; h: () => number }>({ turnTo: () => {}, h: () => 0 })
  // A name picked on the ring also takes the keyboard's place, so Tab and the arrows carry on from it.
  const picked = React.useRef<(i: number) => void>(() => {})

  React.useEffect(() => {
    const sec = section.current, st = stage.current, ringSvg = ring.current, handsEl = hands.current, bandEl = band.current, notesEl = notes.current, partEl = part.current
    if (!sec || !st || !ringSvg || !handsEl || !bandEl || !notesEl || !partEl) return
    const root = document.documentElement
    const motion = matchMedia("(prefers-reduced-motion: reduce)")
    let reduce = motion.matches
    const late = overtureActive() ? OVERTURE_DEADLINE - overtureLeft() : 0
    sec.style.setProperty("--late", `${Math.round(late)}ms`)

    const mvs = movements.map((m) => {
      const start = pieces.findIndex((p) => p.mv === m)
      return { m, start, end: start + m.pieces.length - 1, count: m.pieces.length }
    })

    /* ── the ring: every piece's name between two ellipses, the movements labelled round the outside ── */
    ringSvg.replaceChildren()
    const gArcs = svg("g", { class: "arcs" }, ringSvg)
    const track = svg("ellipse", { class: "faint" }, ringSvg)
    const gDots = svg("g", null, ringSvg)
    const gNames = svg("g", null, ringSvg)
    const gDims = svg("g", { class: "dims" }, ringSvg)
    const lead = svg("line", { class: "lead" }, ringSvg)
    const indexDot = svg("circle", { class: "index-dot", r: 3.5 }, ringSvg)
    // On a phone the hero zero is too small for names: it is the mark itself, set in the gap between the fingers.
    const gMark = svg("g", { class: "gap-mark" }, ringSvg)
    const markO = svg("path", { class: "mk-o", "fill-rule": "evenodd" }, gMark)
    const markDot = svg("circle", { class: "mk-dot" }, gMark)
    const gCall = svg("g", { class: "call", visibility: "hidden" }, ringSvg)
    const callLine = svg("line", { class: "call-line" }, gCall)
    const callDot = svg("circle", { class: "call-dot", r: 2 }, gCall)
    const callName = svg("text", { class: "call-name", "text-anchor": "middle" }, gCall)
    const callMeta = svg("text", { class: "call-meta", "text-anchor": "middle" }, gCall)
    const names = pieces.map((p) => {
      const t = svg("text", { class: "nm" }, gNames)
      t.textContent = p.name
      return t
    })
    const dots = pieces.map(() => svg("circle", { class: "dot", r: 1.5 }, gDots))
    // The dimension across the counter: the hole of the zero is part of the drawing.
    const dim = { line: svg("line", null, gDims), t1: svg("line", null, gDims), t2: svg("line", null, gDims), h: svg("line", null, gDims), v: svg("line", null, gDims) }
    const dimLabel = svg("text", { class: "dim-label", "text-anchor": "middle" }, gDims)
    dimLabel.textContent = "the counter, empty on purpose"
    const arcs: Arc[] = mvs.map((a, k) => {
      const path = svg("path", { id: `zero-arc-${k}`, class: "arc" }, gArcs)
      const t1 = svg("line", { class: "arc" }, gArcs), t2 = svg("line", { class: "arc" }, gArcs)
      const label = svg("text", { class: "arc-label", "text-anchor": "middle" }, gArcs)
      const tp = svg("textPath", { href: `#zero-arc-${k}`, startOffset: "50%" }, label)
      const n = svg("tspan", { class: "n" }, tp)
      n.textContent = a.m.num
      const rest = svg("tspan", null, tp)
      return { ...a, path, t1, t2, label, rest }
    })
    let natural: number[] = []
    // What each name and dot was last set to, so a frame writes only what changed.
    const drawn = names.map(() => ({ at: "", size: "", fit: "", stretch: "", dx: "", dy: "" }))
    const measureNames = () => {
      for (const [i, t] of names.entries()) {
        t.setAttribute("font-size", "20")
        t.removeAttribute("textLength")
        t.setAttribute("lengthAdjust", "spacing")
        t.style.fontVariationSettings = "'wdth' 100"
        drawn[i] = { ...drawn[i], size: "", fit: "", stretch: "" }
      }
      natural = names.map((t) => t.getComputedTextLength() / 20)
    }

    /* ── geometry, measured once per layout ── */
    let G: Geometry | null = null
    let top = 0, intro = 1, pitch = 24, range = 1, y = scrollY
    const stageGeometry = (): Geometry => {
      const W = st.clientWidth, H = st.clientHeight, phone = W <= 760
      const m = bandEl.offsetLeft
      const bandTop = bandEl.offsetTop
      const bar = parseFloat(getComputedStyle(root).getPropertyValue("--bar")) * parseFloat(getComputedStyle(root).fontSize) || 64
      let hero: Shape, dial: Shape
      // Where the hands may reach: under the bar, over the band. On a wide screen the caption hangs under the zero, in
      // the room the hands leave between them; on a phone it sits over the band, and the hands have the room above it.
      const capH = (notesEl.firstElementChild as HTMLElement).offsetHeight
      const room: [number, number] = phone ? [bar + 12, bandTop - 40 - capH] : [bar + 24, bandTop - 14]
      const caption = capH + 18
      // A full dial wants a reading column of at least 520px beside it (the install line and Copy on one row) and a
      // ring tall enough to keep its names legible; short of either, it sits off the left edge, as on a phone.
      const fit = (W - 2 * m - 140 - 520) / 2 / 0.76
      const narrow = !phone && fit < 260
      if (phone) {
        const t = room[0], b = room[1]
        hero = { cx: W / 2, cy: t + (b - t) / 2, ...shape(clamp((b - t) / 2 - 22, 14, 30)) }
        const s1 = shape(Math.min(0.3 * H, 250))
        dial = { cx: -0.4 * s1.rxo, cy: 0.56 * H, ...s1 }
      } else {
        // The zero is as tall as the hands are, so neither outweighs the other.
        const t = bar + 24, b = bandTop - 26 - caption
        hero = { cx: W / 2, cy: t + (b - t) / 2, ...shape(Math.min((b - t) / 2 - 10, 300, Math.max(150, W * 0.125))) }
        // The dial sits in the room under the bar, with space above and below for its movement labels.
        const s1 = shape(Math.min(0.41 * H, (H - bar) / 2 - 56, 380, narrow ? 380 : fit))
        dial = narrow ? { cx: -0.4 * s1.rxo, cy: bar + (H - bar) / 2, ...s1 } : { cx: m + s1.rxo + 40, cy: bar + (H - bar) / 2, ...s1 }
      }
      const cap = phone ? bandTop - 24 - capH : hero.cy + hero.ryo + 18
      return { W, H, m, phone, narrow, hero, dial, room, cap }
    }
    const geomAt = (g: Geometry, h: number): Shape => {
      const a = g.hero, b = g.dial, e = smooth(h)
      return { cx: lerp(a.cx, b.cx, e), cy: lerp(a.cy, b.cy, e), ...shape(lerp(a.ryo, b.ryo, e)) }
    }
    let tabKey = "", tabCache: Tab | null = null
    const midTab = (g: Shape) => {
      const key = `${g.rxo.toFixed(1)}:${g.ryo.toFixed(1)}`
      if (tabKey !== key || !tabCache) {
        tabKey = key
        tabCache = arcTable((g.rxo + g.rxi) / 2, (g.ryo + g.ryi) / 2)
      }
      return tabCache
    }

    /* ── drawing the ring for one moment of the scroll ── */
    // `hover` is the piece being read in the zero: the name pointed at on the ring, else the line pointed at in God's hand.
    let shown = -1, hover = -1, onRing = -1, onHand = -1, cur: Shape | null = null, o = 0, h = 0
    // A custom property restyles everything under the element it is set on, so each goes only to what reads it, and
    // only when it changes.
    const written = new Map<string, string>()
    const put = (el: HTMLElement | SVGElement, name: string, value: string) => {
      const k = `${el.getAttribute("class")}${name}`
      if (written.get(k) === value) return
      written.set(k, value)
      el.style.setProperty(name, value)
    }
    // Where scroll timelines run, the turn from hero to dial is drawn by the scroll itself (app/landing.css); the
    // script writes its numbers only without them, or under reduced motion, where it snaps from one to the other.
    const driven = CSS.supports("animation-timeline: view()")
    // The column beside the dial hangs from the reading line: only these four read it.
    const hung = [...partEl.querySelectorAll<HTMLElement>(":scope > :is(.pieces-head, .readout, .pieces-skip, .pieces-keys)")]
    const layoutRing = (g: Geometry, z: Shape, o: number, h: number) => {
      const tab = midTab(z), { cx, cy, rxo, ryo, rxi, ryi } = z
      const fs = Math.max(g.phone ? 5.5 : 7, ryo / 38)
      const s = mod(Math.round(o), N)
      cur = z
      for (let i = 0; i < N; i++) {
        const t = tAt(tab, mod((i - o) / N, 1)), c = Math.cos(t), sn = Math.sin(t)
        const xi = cx + rxi * c, yi = cy + ryi * sn, xo = cx + rxo * c, yo = cy + ryo * sn
        const dx = xo - xi, dy = yo - yi, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
        const pad = 3, L = Math.max(4, len - pad * 2)
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI
        const right = c >= -0.0001
        const x = right ? xi + ux * pad : xo - ux * pad, y = right ? yi + uy * pad : yo - uy * pad
        const w100 = natural[i] * fs
        const wdth = clamp((100 * L) / w100, 62, 125)
        const wAt = (w100 * wdth) / 100
        const f = wAt > L ? Math.max(4, (fs * L) / wAt) : fs
        const el = names[i], was = drawn[i]
        // The size, fit and width are set to the tenth and the width axis to the unit, so a turning name is set again
        // only when the change would show: a frame re-shapes only the names whose fit moved.
        const at = `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(right ? ang : ang + 180).toFixed(2)})`
        const size = f.toFixed(1), fit = L.toFixed(1), stretch = `'wdth' ${Math.round(wdth)}`
        if (was.at !== at) el.setAttribute("transform", (was.at = at))
        if (was.size !== size) el.setAttribute("font-size", (was.size = size))
        if (was.fit !== fit) el.setAttribute("textLength", (was.fit = fit))
        if (was.stretch !== stretch) el.style.fontVariationSettings = was.stretch = stretch
        const d = mod(i - s + N / 2, N) - N / 2
        el.toggleAttribute("data-sel", d === 0)
        el.toggleAttribute("data-near", Math.abs(d) === 1)
        el.toggleAttribute("data-hover", i === hover)
        const dot = dots[i], dx2 = (cx + (rxo + 10) * c).toFixed(1), dy2 = (cy + (ryo + 10) * sn).toFixed(1)
        if (was.dx !== dx2) dot.setAttribute("cx", (was.dx = dx2))
        if (was.dy !== dy2) dot.setAttribute("cy", (was.dy = dy2))
        dot.toggleAttribute("data-sel", d === 0)
      }
      const named = clamp((ryo - 50) / 70)
      for (const e of [gNames, gDots, track, indexDot]) e.style.opacity = String(named)
      gMark.style.opacity = String(1 - named)
      gMark.style.display = named >= 1 ? "none" : ""
      if (named < 1) {
        markO.setAttribute("d", `M${cx} ${cy - ryo}a${rxo} ${ryo} 0 1 0 0.001 0zM${cx} ${cy - ryi}a${rxi} ${ryi} 0 1 1 -0.001 0z`)
        markDot.setAttribute("cx", String(cx))
        markDot.setAttribute("cy", String(cy))
        markDot.setAttribute("r", String(0.14 * ryo))
      }
      track.setAttribute("cx", String(cx))
      track.setAttribute("cy", String(cy))
      track.setAttribute("rx", String(rxo + 10))
      track.setAttribute("ry", String(ryo + 10))
      indexDot.setAttribute("cx", String(cx + rxo + 10))
      indexDot.setAttribute("cy", String(cy))
      const colx = g.phone ? cx + rxo + 44 : cx + rxo + (g.narrow ? 72 : 100)
      lead.setAttribute("x1", String(cx + rxo + 18))
      lead.setAttribute("y1", String(cy))
      lead.setAttribute("x2", String(g.phone ? cx + rxo + 26 : colx - 18))
      lead.setAttribute("y2", String(cy))
      lead.style.opacity = String(smooth(clamp((h - 0.55) / 0.45)))
      for (const e of hung) {
        put(e, "--cy", `${cy.toFixed(1)}px`)
        put(e, "--colx", `${colx.toFixed(1)}px`)
      }

      // Movement sectors on an outer arc, each labelled along its own curve.
      const arcOpacity = smooth(clamp((h - 0.4) / 0.6))
      gArcs.style.opacity = String(arcOpacity)
      gArcs.style.display = arcOpacity < 0.01 ? "none" : ""
      if (arcOpacity >= 0.01) {
        const rxA = rxo + 24, ryA = ryo + 24
        for (const A of arcs) {
          const f0 = (A.start - 0.5 + 0.3 - o) / N, f1 = (A.end + 0.5 - 0.3 - o) / N
          const pts: [number, number, number][] = []
          const steps = Math.max(6, Math.round(A.count * 3))
          for (let k = 0; k <= steps; k++) {
            const t = tAt(tab, f0 + ((f1 - f0) * k) / steps)
            pts.push([cx + rxA * Math.cos(t), cy + ryA * Math.sin(t), t])
          }
          const bottom = Math.sin(tAt(tab, (f0 + f1) / 2)) > 0.2
          const seq = bottom ? pts.slice().reverse() : pts
          A.path.setAttribute("d", "M" + seq.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L"))
          const tick = (ln: SVGLineElement, p: [number, number, number]) => {
            const c = Math.cos(p[2]), sn = Math.sin(p[2])
            ln.setAttribute("x1", String(cx + (rxA - 5) * c))
            ln.setAttribute("y1", String(cy + (ryA - 5) * sn))
            ln.setAttribute("x2", String(cx + (rxA + 5) * c))
            ln.setAttribute("y2", String(cy + (ryA + 5) * sn))
          }
          tick(A.t1, pts[0])
          tick(A.t2, pts[pts.length - 1])
          A.label.setAttribute("dy", bottom ? "13" : "-6")
          const arcLen = (A.count / N) * Math.PI * (rxA + ryA)
          A.rest.textContent = arcLen > (A.m.name.length + 10) * 7.6 ? ` · ${A.m.name} · ${A.count}` : ` · ${A.count}`
          // A label passing the reading line steps aside for the lead; its movement is named in the readout.
          const tm = tAt(tab, (f0 + f1) / 2), half = (A.m.num.length + A.rest.textContent.length) * 3.9 + 10
          A.label.style.opacity = Math.cos(tm) > 0 ? String(smooth(clamp((Math.abs(ryA * Math.sin(tm)) - half) / 24))) : "1"
        }
      }

      // The counter's dimension, only once the zero is the dial, and not while a name is being read in it.
      gDims.style.opacity = String(g.phone ? 0 : smooth(clamp((h - 0.6) / 0.4)) * (hover >= 0 ? 0 : 1))
      const x1 = cx - rxi + 8, x2 = cx + rxi - 8
      const line = (e: SVGLineElement, a: number, b: number, c: number, d: number) => {
        e.setAttribute("x1", String(a))
        e.setAttribute("y1", String(b))
        e.setAttribute("x2", String(c))
        e.setAttribute("y2", String(d))
      }
      line(dim.line, x1, cy, x2, cy)
      line(dim.t1, x1, cy - 5, x1, cy + 5)
      line(dim.t2, x2, cy - 5, x2, cy + 5)
      line(dim.h, cx - 6, cy + 40, cx + 6, cy + 40)
      line(dim.v, cx, cy + 34, cx, cy + 46)
      dimLabel.setAttribute("x", String(cx))
      dimLabel.setAttribute("y", String(cy - 12))

      if (s !== shown) {
        shown = s
        setSel(s)
      }
      if (hover >= 0) placeCallout(hover)
    }

    const placeCallout = (i: number) => {
      if (!cur) return
      const z = cur, t = tAt(midTab(z), mod((i - o) / N, 1)), c = Math.cos(t), s = Math.sin(t)
      const xi = z.cx + z.rxi * c, yi = z.cy + z.ryi * s
      const ex = z.cx + (xi - z.cx) * 0.72, ey = z.cy + (yi - z.cy) * 0.72
      callLine.setAttribute("x1", String(xi - c * 4))
      callLine.setAttribute("y1", String(yi - s * 4))
      callLine.setAttribute("x2", String(ex))
      callLine.setAttribute("y2", String(ey))
      callDot.setAttribute("cx", String(ex))
      callDot.setAttribute("cy", String(ey))
      callName.setAttribute("x", String(z.cx))
      callName.setAttribute("y", String(z.cy + 4))
      callMeta.setAttribute("x", String(z.cx))
      callMeta.setAttribute("y", String(z.cy + 26))
      callName.textContent = pieces[i].name
      callMeta.textContent = `${pieces[i].mv.num} · ${pad3(i + 1)}`
      gCall.setAttribute("visibility", "visible")
    }

    /* ── the hands: Michelangelo's, set in real letters on two canvases (components/site/hands.ts) ── */
    const canvases = Array.from(handsEl.children) as HTMLCanvasElement[]
    // Adam's hand is what you ask for, in the italic; God's is what we hand back, in roman.
    const streams = [ASKS.map((a) => `Build me ${a} in 0nlyType.`).join(" ") + " ", pieces.map((p) => `add ${p.name}`).join(" · ") + " · "]
    let set: Hand[] = [], grid: Uint8Array | null = null, version = 0, rise = 0, rising = false
    const touch: Touch[] = [0, 1].map(() => ({ x: 0, y: 0, r: 64, s: 0, grow: 0.6, lit: -1, litA: 0, was: -1, wasA: 0, dim: 0 }))
    // God's lines name pieces: "add calendar" is the calendar's phrase, both ways.
    let pieceOf: number[] = [], phraseOf = new Map<number, number>()
    const paint = (t = Infinity) => set.forEach((hand, i) => drawHand(canvases[i], hand, t, 700, 520, t === Infinity ? touch[i] : undefined))
    // The data and the layout engine load only when the hands are drawn, so neither holds up the first paint. A hand
    // is laid out a few milliseconds at a time, giving the frame back between slices, so no task runs long even on a
    // slow phone; a newer layout drops an older one at the next slice.
    const slice = async (steps: Generator<void, Hand>, v: number) => {
      for (;;) {
        const end = performance.now() + 8
        let r = steps.next()
        while (!r.done && performance.now() < end) r = steps.next()
        if (r.done) return r.value
        await new Promise((go) => setTimeout(go))
        if (v !== version || !alive) return null
      }
    }
    const setHands = async (g: Geometry) => {
      const v = ++version
      const [lib, { HANDS }] = await Promise.all([import("@chenglou/pretext"), import("@/lib/site/hands")])
      if (v !== version || !alive) return
      const grid_ = (grid ??= decodeHands(HANDS))
      const { W, hero, phone } = g
      // The fingertips reach for the zero from either side, as painted: God's a little higher than Adam's.
      const gap = hero.rxo + (phone ? 10 : 24), mid = (HANDS.adam[1] + HANDS.god[1]) / 2
      // As large as the room above the band allows; on a wide screen no larger than the arms reaching its edges, on a
      // phone the fresco's own crop, the two hands' fingers nearly touching, large enough to read. Only the ink on
      // screen takes room, and what is on screen depends on the scale, so it is settled in a few rounds.
      const across = phone ? (W / 2 - gap) / 80 : (W * 1.04 - 2 * gap) / (HANDS.adam[0] + HANDS.w - HANDS.god[0])
      let k = across
      for (let round = 0; round < 4; round++) {
        const a = extent(HANDS, grid_, 0, HANDS.adam[0] - (hero.cx - gap) / k), b = extent(HANDS, grid_, 1, 0, HANDS.god[0] + (W - hero.cx - gap) / k)
        const top = Math.min(a.top, b.top), bottom = Math.max(a.bottom, b.bottom)
        k = Math.min(across, (hero.cy - g.room[0]) / (mid - top), (g.room[1] - hero.cy) / (bottom - mid))
      }
      const places: Place[] = [
        { k, tip: { x: hero.cx - gap, y: hero.cy + (HANDS.adam[1] - mid) * k } },
        { k, tip: { x: hero.cx + gap, y: hero.cy + (HANDS.god[1] - mid) * k } },
      ]
      // The film's measure: a budget of letters shared over the ink on screen sets their size.
      const ink = area(HANDS, grid_, 0, places[0], W) + area(HANDS, grid_, 1, places[1], W)
      // A phone's hands are a few fingers tall, so they take finer letters to keep their shape; its screen is dense
      // enough to hold them.
      const fs = clamp(Math.sqrt(ink / ((phone ? 6000 : 9000) * 0.55)), phone ? 4.2 : 5.5, 11), fy = fs * 1.12
      const css = getComputedStyle(root), v_ = (n: string) => css.getPropertyValue(n).trim()
      const voice = v_("--ot-voice"), expr = v_("--ot-expression")
      const fonts = [[700, 600, 500, 500].map((w) => `italic ${w} ${fy}px ${expr}`), [700, 500, 350, 350].map((w) => `${w} ${fs}px ${voice}`)]
      const inks = [v_("--ot-ink"), v_("--ot-ink"), v_("--ot-graphite"), v_("--ot-pencil")]
      const res = Math.min(2, devicePixelRatio || 1)
      const next: Hand[] = []
      for (const side of [0, 1] as const) {
        const hand = await slice(setHand(lib, HANDS, grid_, side, places[side], streams[side], fonts[side], inks, side ? fs : fy, W, res), v)
        if (!hand) return
        next.push(hand)
      }
      set = next
      const byName = new Map(pieces.map((q) => [q.name, q.i]))
      pieceOf = next[1].phrases.map((t) => (t.startsWith("add ") ? (byName.get(t.slice(4)) ?? -1) : -1))
      phraseOf = new Map(pieceOf.flatMap((i, k) => (i >= 0 ? [[i, k] as [number, number]] : [])))
      for (const T of touch) Object.assign(T, { s: 0, lit: -1, litA: 0, was: -1, wasA: 0, dim: 0, r: Math.max(48, next[0].fs * 8) })
      next.forEach((hand, i) => {
        const c = canvases[i], b = hand.box
        c.width = Math.ceil(b.w * res)
        c.height = Math.ceil(b.h * res)
        c.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`
      })
      play(gap * 0.5)
    }

    // The overture (P4): the letters come up out of the paper from the fingertips back, and the hands close the gap
    // to the zero. It is a clock on the frames, so a late start skips what has passed and it still ends in time.
    const RUN = 700 + 520
    const play = (shift = 0) => {
      cancelAnimationFrame(rise)
      const settle = () => {
        rising = false
        lean = 0
        for (const c of canvases) c.style.transform = ""
        paint()
        sense()
      }
      if (reduce || !overtureActive()) return settle()
      rising = true
      const start = performance.now() - Math.max(0, RUN - overtureLeft())
      const frame = (now: number) => {
        const t = now - start
        if (t >= RUN || !overtureActive()) return settle()
        const e = (1 - Math.min(1, t / RUN)) ** 3
        canvases[0].style.transform = `translateX(${(-e * shift).toFixed(1)}px)`
        canvases[1].style.transform = `translateX(${(e * shift).toFixed(1)}px)`
        paint(t)
        rise = requestAnimationFrame(frame)
      }
      rise = requestAnimationFrame(frame)
    }

    // Pointing at the hands, once they have settled and while they are the hero, on a screen with a fine pointer. Each
    // frame finds the letter nearest the pointer in each hand; the loupe follows it a little behind, the phrase it
    // belongs to is read in the bold cut as the rest of that hand steps back, and the hands lean in by a few pixels as
    // the pointer nears the zero. Every value eases toward its aim on the tempo tokens (hover at allegro, 160ms; the
    // lean and the stepping back at moderato, 320ms), and the frames stop once all of them have arrived. Under reduced
    // motion the ink still answers, at once, and nothing moves or swells.
    const fine = matchMedia("(hover: hover) and (pointer: fine)")
    let px = 0, py = 0, inside = false, lean = 0, felt = 0, feltAt = 0
    const toward = (v: number, aim: number, ms: number, dt: number) => {
      const next = reduce ? aim : aim + (v - aim) * Math.exp((-3 * dt) / ms)
      return Math.abs(next - aim) < 0.002 ? aim : next
    }
    const feel = (now: number) => {
      felt = 0
      const dt = feltAt ? Math.min(50, now - feltAt) : 16
      feltAt = now
      const live = inside && fine.matches && !rising && set.length === 2 && h < 0.2 && !!G
      let moving = false, pick = -1
      set.forEach((hand, i) => {
        const T = touch[i], was = `${T.x}${T.y}${T.s}${T.lit}${T.litA}${T.wasA}${T.dim}`
        let near = -1, lx = 0, ly = 0
        if (live) {
          const b = canvases[i].getBoundingClientRect()
          lx = px - b.left
          ly = py - b.top
          let best = (hand.fs * 2.4) ** 2
          if (lx > -40 && ly > -40 && lx < b.width + 40 && ly < b.height + 40)
            for (let j = 0; j < hand.n; j++) {
              const dx = hand.x[j] - lx, dy = hand.y[j] - ly, d = dx * dx + dy * dy
              if (d < best) {
                best = d
                near = hand.phrase[j]
              }
            }
        }
        const over = near >= 0
        if (i === 1 && over) pick = pieceOf[near] ?? -1
        // A name pointed at on the ring is read in God's hand too, wherever its line comes round.
        const aim = over ? near : live && i === 1 && onRing >= 0 ? (phraseOf.get(onRing) ?? -1) : -1
        if (aim !== T.lit) {
          if (aim === T.was) [T.lit, T.litA, T.was, T.wasA] = [T.was, T.wasA, T.lit, T.litA]
          else [T.was, T.wasA, T.lit, T.litA] = [T.lit, T.litA, aim, 0]
        }
        if (over && T.s === 0) {
          T.x = lx
          T.y = ly
        }
        if (over) {
          T.x = toward(T.x, lx, 70, dt)
          T.y = toward(T.y, ly, 70, dt)
        }
        T.grow = reduce ? 0 : 0.6
        T.s = toward(T.s, over ? 1 : 0, 160, dt)
        T.litA = toward(T.litA, T.lit >= 0 ? 1 : 0, 160, dt)
        T.wasA = toward(T.wasA, 0, 160, dt)
        T.dim = toward(T.dim, T.lit >= 0 ? 1 : 0, 320, dt)
        if (`${T.x}${T.y}${T.s}${T.lit}${T.litA}${T.wasA}${T.dim}` !== was) {
          moving = true
          drawHand(canvases[i], hand, Infinity, 700, 520, T)
        }
      })
      // The reach: as the pointer comes to the zero, each hand leans toward it.
      let aim = 0
      if (live && !reduce && G) {
        const b = st.getBoundingClientRect(), d = Math.hypot(px - b.left - G.hero.cx, py - b.top - G.hero.cy)
        aim = smooth(clamp(1.6 - d / G.hero.rxo))
      }
      const next = toward(lean, aim, 320, dt)
      if (next !== lean && !rising) {
        lean = next
        moving = true
        const by = (lean * (G?.phone ? 4 : 9)).toFixed(2)
        canvases[0].style.transform = lean ? `translateX(${by}px)` : ""
        canvases[1].style.transform = lean ? `translateX(-${by}px)` : ""
      }
      if (pick !== onHand) {
        onHand = pick
        point()
      }
      if (moving) sense()
      else feltAt = 0
    }
    const sense = () => {
      if (!felt) felt = requestAnimationFrame(feel)
    }

    // The plate's caption sits under the zero; Skip intro, while the overture plays, waits under it.
    const placeNotes = (g: Geometry) => {
      const c = notesEl.firstElementChild as HTMLElement, ny = g.cap
      c.style.transform = `translate(${g.hero.cx - c.offsetWidth / 2}px, ${ny}px)`
      const skip = st.querySelector<HTMLElement>(".hero-skip")
      if (skip) skip.style.transform = `translate(${g.hero.cx - skip.offsetWidth / 2}px, ${ny + c.offsetHeight + 8}px)`
    }

    /* ── the scroll: the hands fall away, the zero moves aside and becomes the dial, then the dial turns ── */
    const relayout = () => {
      const r = sec.getBoundingClientRect()
      y = scrollY
      top = r.top + y
      const Hh = st.clientHeight
      intro = Math.round(Hh * 0.75)
      pitch = st.clientWidth <= 760 ? 20 : 24
      range = Math.max(1, sec.offsetHeight - Hh)
      measureNames()
      G = stageGeometry()
      placeNotes(G)
      void setHands(G)
      key = ""
      render(true)
    }
    const detent = (x: number) => {
      const k = Math.floor(x)
      return k + smooth(smooth(x - k))
    }
    const target = () => {
      const s = clamp(y - top, 0, range)
      const raw = clamp((s - intro - 20) / (N * pitch)) * (N - 1)
      return { s, h: clamp(s / intro), raw }
    }
    const scrollToPiece = (i: number) => {
      scrollTo({ top: top + intro + 20 + (i / (N - 1)) * N * pitch, behavior: reduce ? "auto" : "smooth" })
    }

    let key = ""
    const render = (force = false) => {
      if (!G) return
      const k = `${h.toFixed(4)}:${o.toFixed(4)}:${hover}`
      if (!force && k === key) return
      key = k
      layoutRing(G, geomAt(G, h), o, h)
      const out = clamp(h * 1.8), inn = smooth(clamp((h - 0.6) / 0.4))
      const scripted = !driven || reduce, quiet = (1 - clamp(h * 3)).toFixed(3)
      put(handsEl, "--h", scripted ? h.toFixed(4) : "")
      put(notesEl, "--notes", scripted ? quiet : "")
      put(bandEl, "--out", scripted ? out.toFixed(3) : "")
      put(partEl, "--inn", scripted ? inn.toFixed(3) : "")
      st.toggleAttribute("data-dial", h >= 0.6)
      st.toggleAttribute("data-hero", h < 0.5)
    }

    // The dial follows the scroll through a critically damped spring: it settles on each notch, never jumps.
    let v = 0, raf = 0, last = 0
    const tick = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60
      last = now
      const T = target()
      if (reduce) {
        h = T.h >= 0.5 ? 1 : 0
        o = Math.round(T.raw)
        v = 0
      } else {
        h = T.h
        const goal = detent(T.raw), w = 18
        v += (w * w * (goal - o) - 2 * w * v) * dt
        o += v * dt
        if (Math.abs(goal - o) < 0.0005 && Math.abs(v) < 0.001) {
          o = goal
          v = 0
        }
      }
      render()
      if (v !== 0) raf = requestAnimationFrame(tick)
      else last = 0
      // The scroll takes the hands away, and whatever a pointer was doing to them goes with them.
      if (lean || touch.some((T) => T.s || T.lit >= 0)) sense()
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    // The scroll is read as it happens, while the page is still laid out, so no frame has to lay it out again to ask.
    const onScroll = () => {
      y = scrollY
      wake()
    }
    const first = target()
    h = reduce ? (first.h >= 0.5 ? 1 : 0) : first.h
    o = reduce ? Math.round(first.raw) : detent(first.raw)

    // Pointing reads a name; clicking (or tapping) one turns the dial to it.
    const hit = (ev: PointerEvent | MouseEvent) => {
      if (!cur) return -1
      const z = cur, b = ringSvg.getBoundingClientRect()
      const u = (ev.clientX - b.left - z.cx) / ((z.rxo + z.rxi) / 2), w = (ev.clientY - b.top - z.cy) / ((z.ryo + z.ryi) / 2)
      const r = Math.hypot(u, w)
      if (z.ryo < 50 || r < 0.62 || r > 1.32) return -1
      return mod(Math.round(fAt(midTab(z), Math.atan2(w, u)) * N + o), N)
    }
    const point = () => {
      const i = onRing >= 0 ? onRing : onHand
      if (i === hover) return
      hover = i
      ringSvg.toggleAttribute("data-pointing", i >= 0)
      if (i < 0) gCall.setAttribute("visibility", "hidden")
      render(true)
    }
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return
      px = ev.clientX
      py = ev.clientY
      inside = true
      sense()
      onRing = hit(ev)
      point()
    }
    const onLeave = () => {
      inside = false
      onRing = -1
      point()
      sense()
    }
    const onClick = (ev: MouseEvent) => {
      const at = hit(ev), i = at >= 0 ? at : onHand
      if (i < 0) return
      // The focus first: from the hero, focusing the list turns to the piece it last held, and the turn to this one
      // must come after it.
      picked.current(i)
      scrollToPiece(i)
    }
    ringSvg.addEventListener("pointermove", onMove)
    ringSvg.addEventListener("pointerleave", onLeave)
    ringSvg.addEventListener("click", onClick)
    addEventListener("scroll", onScroll, { passive: true })
    let rT = 0
    const onResize = () => {
      clearTimeout(rT)
      rT = window.setTimeout(relayout, 120)
    }
    addEventListener("resize", onResize)
    const onMotion = () => {
      reduce = motion.matches
      play()
      key = ""
      wake()
    }
    motion.addEventListener("change", onMotion)
    const offOverture = onOvertureEnd(() => {
      play()
      key = ""
      wake()
    })
    // A new pair is a new set of letters, and a new mode new inks: the hands and the names are set again once the fonts
    // arrive.
    const pair = new MutationObserver(() => {
      requestAnimationFrame(() => void document.fonts.ready.then(relayout))
    })
    pair.observe(root, { attributes: true, attributeFilter: ["data-pair", "data-mode"] })
    let alive = true
    void document.fonts.ready.then(() => {
      if (alive) relayout()
    })

    api.current = { turnTo: scrollToPiece, h: () => target().h }
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(rT)
      ringSvg.removeEventListener("pointermove", onMove)
      ringSvg.removeEventListener("pointerleave", onLeave)
      ringSvg.removeEventListener("click", onClick)
      removeEventListener("scroll", onScroll)
      removeEventListener("resize", onResize)
      motion.removeEventListener("change", onMotion)
      offOverture()
      cancelAnimationFrame(rise)
      cancelAnimationFrame(felt)
      pair.disconnect()
    }
  }, [movements, pieces, N])

  // The list is the keyboard's dial: one stop in the tab order, the arrows turn it, Enter opens the piece.
  const links = React.useRef<(HTMLAnchorElement | null)[]>([])
  React.useEffect(() => {
    picked.current = (i) => links.current[i]?.focus({ preventScroll: true })
  }, [])
  const go = (i: number) => {
    const n = clamp(i, 0, N - 1)
    setActive(n)
    api.current.turnTo(n)
    links.current[n]?.focus({ preventScroll: true })
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    if (e.key in step) go(active + step[e.key])
    else if (e.key === "Home") go(0)
    else if (e.key === "End") go(N - 1)
    else if (e.key === "PageDown") go(active + 10)
    else if (e.key === "PageUp") go(active - 10)
    else return
    e.preventDefault()
  }
  const into = () => {
    if (api.current.h() < 1) api.current.turnTo(keys ? active : sel)
  }
  const p = pieces[sel] ?? pieces[0]
  const num = pad3(sel + 1), lead = num.match(/^0*/)?.[0] ?? ""
  const tabStop = keys ? active : sel

  return (
    <section ref={section} className="zero" aria-labelledby="hero-title" style={{ "--n": N } as React.CSSProperties}>
      <OvertureScript />
      <span className="zero-at" id="the-pieces" data-rail="The pieces" data-rail-num="01" />
      <div ref={stage} className="zero-stage" data-hero="" data-keys={keys || undefined}>
        <div ref={hands} className="zero-hands" aria-hidden="true">
          <canvas className="hand-a" />
          <canvas className="hand-g" />
        </div>
        <svg ref={ring} className="zero-ring" aria-hidden="true" />

        <div ref={notes} className="zero-notes">
          <p className="note note-c">
            Michelangelo&rsquo;s hands, set in <i>what you ask for</i> and what we hand back, reach for a zero of all <b>{count}</b> components, by name.{" "}
            <span className="note-turn">Scroll, and it turns.</span>
          </p>
        </div>

        <div ref={band} className="hero-band" onFocus={() => api.current.h() > 0 && scrollTo({ top: 0, behavior: "auto" })}>
          <Wordmark id="hero-title" className="hero-mark" />
          <div className="hero-says">
            <span className="hero-cta">
              <Cta href="/docs/">Read the docs</Cta>
            </span>
          </div>
          <div className="hero-install">
            <p className="hero-count">
              {count} React components, set in words, for the shadcn CLI.
            </p>
            <CopyCommand command={install("button")} emphasis="button" />
          </div>
        </div>
        <Overture />

        <div ref={part} className="pieces-part" onFocus={into}>
          <div className="pieces-head">
            <p className="pieces-meta">
              <span>(01)</span>
              <span>The pieces</span>
              <span className="pieces-meta-r">
                {p.mv.num} {p.mv.name}
              </span>
            </p>
            <h2 className="pieces-title" id="pieces">
              {count} pieces.
              <br />
              Turn to one.
            </h2>
          </div>
          <div className="readout">
            <p className="ro-num" aria-hidden="true">
              <span className="ro-lead">{lead}</span>
              {num.slice(lead.length)}
            </p>
            <div className="ro-body">
              <p className="ro-of">
                <span>
                  {p.mv.num} {p.mv.name}
                </span>
                <span>
                  {sel + 1}/{N}
                </span>
              </p>
              <p className="ro-name">{p.title}</p>
              <p className="ro-desc">{p.summary}</p>
            </div>
            <div className="ro-cmd">
              <CopyCommand command={install(p.name)} emphasis={p.name} />
            </div>
          </div>
          <p className="pieces-keys" aria-hidden="true">
            Arrow keys turn it. Enter opens the piece.
          </p>
          <p className="pieces-skip">
            <a className="ot-link" href="#leaves">
              Skip the index
            </a>
            <NextLink className="ot-link" href="/docs/">
              Every piece as a list
            </NextLink>
          </p>
          <nav className="pieces-nav" aria-label="Every piece">
            <ol
              ref={list}
              className="pieces-list"
              onKeyDown={onKeyDown}
              onFocus={(e) => {
                const i = Number((e.target as HTMLElement).dataset.i)
                if (Number.isInteger(i)) setActive(i)
                setKeys(true)
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeys(false)
              }}
            >
              {pieces.map((q) => (
                <li key={q.name}>
                  <NextLink
                    ref={(el) => {
                      links.current[q.i] = el
                    }}
                    href={`/docs/${q.name}/`}
                    prefetch={false}
                    data-i={q.i}
                    tabIndex={q.i === tabStop ? 0 : -1}
                    aria-current={q.i === sel ? "true" : undefined}
                  >
                    {pad3(q.i + 1)}. {q.title}, {q.mv.name}. {q.summary}
                  </NextLink>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  )
}
