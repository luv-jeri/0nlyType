"use client"

import { registryURL } from "@/lib/site/config.mjs"
import { OVERTURE_DEADLINE } from "@/lib/site/overture.mjs"
import NextLink from "next/link"
import * as React from "react"

import { CopyCommand } from "@/components/site/landing"
import { Cta } from "@/components/site/landing-hero"
import { Overture, OvertureScript, onOvertureEnd, overtureActive, overtureLeft } from "@/components/site/landing-overture"
import { Wordmark } from "@/components/site/wordmark"
import { ADAM, GOD, type Figure } from "@/lib/site/figures"

// The hero and 01, the pieces, on one sticky stage turned by the scroll. Two hands set in real letters reach toward a
// zero made of every piece's name: Adam's hand is what you ask for, in the italic; God's is what we hand back, an
// install line for every piece, in roman. Each row of the fresco's tone grid is filled with words, three weights
// following its light and shade, so the fingers read. Scroll, and the letters fall away, the zero moves aside and
// becomes a dial, and the dial turns, one piece per notch, with a settled spring. Point at a name to read it; click
// it, or use the arrow keys in the list, to turn to it.
//
// Everything the scroll moves is written, never read: positions are measured once per layout (on resize, when the
// fonts arrive, when the pair changes), and the scroll handler reads only scrollY, before any frame writes. Each
// value is written only where it is read, and only when it changes. Screen readers and keyboards get
// the index as a real list of links; the drawing is aria-hidden and captioned by the notes beside it.

export type Piece = { name: string; title: string; summary: string }
export type Movement = { num: string; name: string; pieces: Piece[] }

type Flat = Piece & { mv: Movement; i: number }
type Arc = { m: Movement; start: number; end: number; count: number; path: SVGPathElement; t1: SVGLineElement; t2: SVGLineElement; label: SVGTextElement; rest: SVGTSpanElement }
type Shape = { cx: number; cy: number; ryo: number; rxo: number; ryi: number; rxi: number }
type Geometry = { W: number; H: number; m: number; phone: boolean; narrow: boolean; hero: Shape; dial: Shape; room: [number, number] }
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
// The tone grids are run-length coded (lib/site/figures.ts); the drawing wants one digit per cell, 0 empty to 3 dark.
const decode = (f: Figure) => f.rows.map((r) => r.replace(/([a-d])(\d+)/g, (_, t: string, n: string) => String("abcd".indexOf(t)).repeat(Number(n))))
// A seeded scatter, so the letters fall the same way every visit.
const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
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
  const hands = React.useRef<SVGSVGElement>(null)
  const band = React.useRef<HTMLDivElement>(null)
  const notes = React.useRef<HTMLDivElement>(null)
  const part = React.useRef<HTMLDivElement>(null)
  const list = React.useRef<HTMLOListElement>(null)
  // The engine's two doors for React: turn to a piece, and say where the scroll stands.
  const api = React.useRef<{ turnTo: (i: number) => void; h: () => number }>({ turnTo: () => {}, h: () => 0 })
  // A name picked on the ring also takes the keyboard's place, so Tab and the arrows carry on from it.
  const picked = React.useRef<(i: number) => void>(() => {})

  React.useEffect(() => {
    const sec = section.current, st = stage.current, ringSvg = ring.current, handsSvg = hands.current, bandEl = band.current, notesEl = notes.current, partEl = part.current
    if (!sec || !st || !ringSvg || !handsSvg || !bandEl || !notesEl || !partEl) return
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
      // Where the hands may reach: under the notes, over the band.
      const notes = Array.from(notesEl.children) as HTMLElement[]
      const room: [number, number] = [bar + (phone ? 10 : 20) + Math.max(notes[0].offsetHeight, notes[1].offsetHeight) + 12, bandTop - 14]
      // A full dial wants a reading column of at least 520px beside it (the install line and Copy on one row) and a
      // ring tall enough to keep its names legible; short of either, it sits off the left edge, as on a phone.
      const fit = (W - 2 * m - 140 - 520) / 2 / 0.76
      const narrow = !phone && fit < 260
      if (phone) {
        const t = bar + 8, b = bandTop - 18
        hero = { cx: W / 2, cy: t + (b - t) / 2, ...shape(clamp((b - t) / 2 - 22, 14, 30)) }
        const s1 = shape(Math.min(0.3 * H, 250))
        dial = { cx: -0.4 * s1.rxo, cy: 0.56 * H, ...s1 }
      } else {
        const t = bar + 24, b = bandTop - 26
        hero = { cx: W / 2, cy: t + (b - t) / 2, ...shape(Math.min((b - t) / 2 - 10, 300)) }
        // The dial sits in the room under the bar, with space above and below for its movement labels.
        const s1 = shape(Math.min(0.41 * H, (H - bar) / 2 - 56, 380, narrow ? 380 : fit))
        dial = narrow ? { cx: -0.4 * s1.rxo, cy: bar + (H - bar) / 2, ...s1 } : { cx: m + s1.rxo + 40, cy: bar + (H - bar) / 2, ...s1 }
      }
      return { W, H, m, phone, narrow, hero, dial, room }
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
    let shown = -1, hover = -1, cur: Shape | null = null, o = 0, h = 0
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

    /* ── the hands: each row of the fresco's tone grid, filled with real words in three weights ── */
    const ADAM_ROWS = decode(ADAM), GOD_ROWS = decode(GOD)
    const ctx = document.createElement("canvas").getContext("2d")
    const streams = {
      yours: ASKS.map((a) => `Build me ${a} in 0nlyType.`).join(" ") + " ",
      ours: pieces.map((p) => install(p.name).toUpperCase()).join("   ") + "   ",
    }
    let noteLines: SVGGElement | null = null
    // Each letter with the two seeds of its fall.
    let fallers: { t: SVGTextElement; r: number; r2: number }[] = []
    const buildHands = (g: Geometry) => {
      unfall()
      fallers = []
      handsSvg.replaceChildren()
      if (!ctx) return
      const { W, hero, phone } = g
      const fs = phone ? 5.4 : 7.4, rowPitch = fs * 0.86
      const css = getComputedStyle(root)
      const voice = css.getPropertyValue("--ot-voice").trim(), expr = css.getPropertyValue("--ot-expression").trim()
      const sideW = hero.cx - hero.rxo - 16
      const k = phone ? clamp(sideW / 40, 1.6, 3.8) : clamp(sideW / 78, 3, 6.4)
      handsSvg.style.setProperty("--hfs", `${fs}px`)
      handsSvg.style.setProperty("--gap", `${(hero.rxo * 0.5 + 24).toFixed(1)}px`)
      handsSvg.style.setProperty("--fall", `${g.H}px`)
      const rand = random(105)
      const plan = [
        { rows: ADAM_ROWS, cell: ADAM.cell ?? 1, kind: "yours" as const, tip: "right", ax: hero.cx - hero.rxo - 14, font: (w: number) => `italic ${w} ${fs}px ${expr}`, weights: [400, 600, 900] },
        { rows: GOD_ROWS, cell: GOD.cell ?? 1, kind: "ours" as const, tip: "left", ax: hero.cx + hero.rxo + 16, font: (w: number) => `${w} extra-condensed ${fs}px ${voice}`, weights: [400, 700, 900] },
      ]
      const widths = new Map<string, number>()
      for (const P of plan) {
        const { rows, cell } = P
        // The fingertip: the run that reaches furthest toward the zero.
        let tipCol = P.tip === "right" ? -1 : 1e9, tipRow = 0
        rows.forEach((r, ri) => {
          if (P.tip === "right") {
            const c = r.replace(/0+$/, "").length - 1
            if (c > tipCol) {
              tipCol = c
              tipRow = ri
            }
          } else if (/[1-3]/.test(r)) {
            const c = r.length - r.replace(/^0+/, "").length
            if (c < tipCol) {
              tipCol = c
              tipRow = ri
            }
          }
        })
        const ay = hero.cy
        // The hand keeps its scale unless it would run into the notes above or the band below.
        const first = rows.findIndex((r) => /[1-3]/.test(r)), last = rows.length - 1 - [...rows].reverse().findIndex((r) => /[1-3]/.test(r))
        const kk = Math.min(k, tipRow > first ? (ay - g.room[0]) / ((tipRow - first) * cell) : k, (g.room[1] - ay) / ((last + 1 - tipRow) * cell))
        const toCol = (x: number) => Math.floor((x - P.ax) / kk / cell + tipCol)
        const yTop = ay - tipRow * cell * kk, yBottom = ay + (rows.length - tipRow) * cell * kk
        const x0 = P.tip === "right" ? 0 : P.ax - 2, x1 = P.tip === "right" ? P.ax + 2 : W
        const reach = Math.max(1, P.tip === "right" ? P.ax : W - P.ax)
        const stream = { text: streams[P.kind], i: 0 }
        const width = (ch: string, w: number) => {
          const key = `${P.kind}${w}${ch}`
          let v = widths.get(key)
          if (v === undefined) {
            ctx.font = P.font(w)
            v = ctx.measureText(ch).width
            widths.set(key, v)
          }
          return v
        }
        const grp = svg("g", { class: P.kind }, handsSvg)
        const step = 1.5, min = fs * 0.9
        for (let y = yTop + rowPitch / 2; y < yBottom; y += rowPitch) {
          const row = rows[Math.floor((y - ay) / kk / cell + tipRow)]
          if (!row) continue
          // Runs of one tone along the row; a run shorter than a letter joins its neighbour, so edges stay letter-sized.
          const runs: { t: number; a: number; b: number }[] = []
          let run: { t: number; a: number; b: number } | null = null
          for (let x = x0; x <= x1; x += step) {
            const c = toCol(x), t = c >= 0 && c < row.length ? Number(row[c]) : 0
            if (run && run.t === t) run.b = x + step
            else {
              if (run) runs.push(run)
              run = { t, a: x, b: x + step }
            }
          }
          if (run) runs.push(run)
          for (let i = 0; i < runs.length; i++) {
            const r = runs[i]
            if (!r.t || r.b - r.a >= min) continue
            const n = runs[i - 1]?.t ? runs[i - 1] : runs[i + 1]?.t ? runs[i + 1] : null
            if (n) {
              n.a = Math.min(n.a, r.a)
              n.b = Math.max(n.b, r.b)
            }
            r.t = 0
          }
          for (const r of runs) {
            const w = r.b - r.a
            if (!r.t || w < min) continue
            const weight = P.weights[r.t - 1]
            while (stream.text[stream.i % stream.text.length] === " ") stream.i++
            let used = 0, s = ""
            while (used < w - 0.5) {
              const ch = stream.text[stream.i % stream.text.length]
              stream.i++
              s += ch
              used += width(ch, weight)
            }
            s = s.replace(/\s+$/, "")
            if (!s) continue
            const t = svg("text", { x: r.a.toFixed(1), y: y.toFixed(1), textLength: w.toFixed(1), lengthAdjust: "spacing", class: `w${r.t}` }, grp)
            t.textContent = s
            // --k orders the settle from the shoulder to the fingertip; --r and --r2 seed the fall.
            const along = P.tip === "right" ? (r.a + w / 2) / reach : (W - r.a - w / 2) / reach
            const r1 = Number(rand().toFixed(3)), r2 = Number(rand().toFixed(3))
            t.style.cssText = `--k:${clamp(along).toFixed(3)};--r:${r1};--r2:${r2}`
            fallers.push({ t, r: r1, r2 })
          }
        }
      }
      placeNotes(g)
    }

    // Where the browser has view timelines, each letter's fall is its own animation on the zero's scroll, with its
    // numbers already in the keyframes, so a frame resolves no custom property for any letter. The ranges are the
    // script's: begun at --r of the first 15svh, over 60svh, a quarter-curve so it accelerates as it drops. They wait for
    // the overture to end, since an animation from script would sit over its settle.
    type Ranged = KeyframeAnimationOptions & { rangeStart: unknown; rangeEnd: unknown }
    const Timeline = (window as unknown as { ViewTimeline?: new (o: { subject: Element; axis: string }) => AnimationTimeline }).ViewTimeline
    let falling: Animation[] = []
    function unfall() {
      for (const a of falling) a.cancel()
      falling = []
    }
    const fall = () => {
      unfall()
      if (!Timeline || !driven || !G || reduce || overtureActive()) return
      const timeline = new Timeline({ subject: sec, axis: "block" })
      const vh = st.clientHeight / 100, drop = G.H
      const at = (v: number) => ({ rangeName: "contain", offset: CSS.px(Math.round(v)) })
      falling = fallers.map(({ t, r, r2 }) => {
        const frame = (e: number) => ({
          transform: `translate(${((r2 - 0.5) * 120 * e).toFixed(1)}px, ${(e * e * (0.35 + r) * drop).toFixed(1)}px) rotate(${((r2 - 0.5) * 70 * e).toFixed(1)}deg)`,
          opacity: 1 - e,
        })
        const options: Ranged = { timeline, fill: "both", rangeStart: at(r * 15 * vh), rangeEnd: at((60 + r * 15) * vh) }
        return t.animate([0, 0.25, 0.5, 0.75, 1].map(frame), options)
      })
    }

    // The museum labels: (a) and (b) hang from their hands on a hairline; (c) sits in the counter.
    const placeNotes = (g: Geometry) => {
      const { hero, W, m, phone } = g
      const [a, b, c] = Array.from(notesEl.children) as HTMLElement[]
      const topY = (parseFloat(getComputedStyle(root).getPropertyValue("--bar")) || 4) * 16 + (phone ? 10 : 20)
      a.style.transform = `translate(${m}px, ${topY}px)`
      b.style.transform = `translate(${W - m - b.offsetWidth}px, ${topY}px)`
      if (phone) {
        const ny = g.hero.cy + g.hero.ryo + 14
        c.style.transform = `translate(${hero.cx - c.offsetWidth / 2}px, ${ny}px)`
      } else {
        c.style.maxWidth = `${hero.rxi * 1.5}px`
        c.style.transform = `translate(${hero.cx - c.offsetWidth / 2}px, ${hero.cy - c.offsetHeight / 2}px)`
      }
      // Skip intro, while the overture plays, waits under the zero's caption, in the one place nothing else is.
      const skip = st.querySelector<HTMLElement>(".hero-skip")
      if (skip) {
        const cy = phone ? g.hero.cy + g.hero.ryo + 14 : hero.cy - c.offsetHeight / 2
        skip.style.transform = `translate(${hero.cx - skip.offsetWidth / 2}px, ${cy + c.offsetHeight + 8}px)`
      }
      noteLines = svg("g", { class: "note-lines" }, handsSvg)
      const rowsTop = (kind: string, x: number) => {
        let best = Infinity
        for (const t of handsSvg.querySelectorAll<SVGTextElement>(`.${kind} text`)) {
          const ax = Number(t.getAttribute("x")), w = Number(t.getAttribute("textLength")), y = Number(t.getAttribute("y"))
          if (x >= ax && x <= ax + w && y < best) best = y
        }
        return best
      }
      const hang = (note: HTMLElement, x: number, kind: string) => {
        const yTop = topY + note.offsetHeight + 6, yEnd = rowsTop(kind, x) - 8
        if (Number.isFinite(yEnd) && yEnd > yTop + 8 && noteLines) {
          svg("line", { class: "note-line", x1: x, y1: yTop, x2: x, y2: yEnd }, noteLines)
          svg("circle", { class: "note-dot", cx: x, cy: yEnd + 3, r: 1.6 }, noteLines)
        }
      }
      hang(a, m + (phone ? 24 : 60), "yours")
      hang(b, W - m - (phone ? 24 : 60), "ours")
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
      buildHands(G)
      fall()
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
      put(handsSvg, "--h", falling.length ? "" : h.toFixed(4))
      put(handsSvg, "--notes", scripted ? quiet : "")
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
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch") return
      const i = hit(ev)
      if (i === hover) return
      hover = i
      ringSvg.toggleAttribute("data-pointing", i >= 0)
      if (i < 0) gCall.setAttribute("visibility", "hidden")
      render(true)
    }
    const onLeave = () => {
      hover = -1
      ringSvg.removeAttribute("data-pointing")
      gCall.setAttribute("visibility", "hidden")
      render(true)
    }
    const onClick = (ev: MouseEvent) => {
      const i = hit(ev)
      if (i < 0) return
      scrollToPiece(i)
      picked.current(i)
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
      fall()
      key = ""
      wake()
    }
    motion.addEventListener("change", onMotion)
    const offOverture = onOvertureEnd(() => {
      fall()
      key = ""
      wake()
    })
    // A new pair is a new set of letters: the hands and the names are set again once its fonts arrive.
    const pair = new MutationObserver(() => {
      requestAnimationFrame(() => void document.fonts.ready.then(relayout))
    })
    pair.observe(root, { attributes: true, attributeFilter: ["data-pair"] })
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
      unfall()
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
        <svg ref={hands} className="zero-hands" aria-hidden="true" />
        <svg ref={ring} className="zero-ring" aria-hidden="true" />

        <div ref={notes} className="zero-notes">
          <p className="note">
            <span className="note-k">(a)</span> What you ask for, set in <i>italic</i>.
          </p>
          <p className="note note-b">
            <span className="note-k">(b)</span> What we hand back: an install line for every piece, in roman.
          </p>
          <p className="note note-c">
            <span className="note-k">(c)</span> The zero: all <b>{count}</b> components, by name. <span className="note-turn">Scroll, and it turns.</span>
          </p>
        </div>

        <div ref={band} className="hero-band" onFocus={() => api.current.h() > 0 && scrollTo({ top: 0, behavior: "auto" })}>
          <Wordmark id="hero-title" className="hero-mark" />
          <div className="hero-says">
            <p className="hero-zero">
              <span className="hero-zero-k">0 =</span> pictures, boxes and shadows. Everything else is type, even the hands.
            </p>
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
