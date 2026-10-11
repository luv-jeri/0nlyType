"use client"

import { registryURL } from "@/lib/site/config.mjs"
import { OVERTURE_DEADLINE } from "@/lib/site/overture.mjs"
import NextLink from "next/link"
import * as React from "react"

import { CopyCommand } from "@/components/site/landing"
import { DocsField } from "@/components/site/landing-docs"
import { PiecePreview } from "@/components/site/landing-preview"
import { Overture, OvertureScript, onOvertureEnd, overtureActive, overtureLeft } from "@/components/site/landing-overture"
import { area, decodeHands, drawHand, extent, setHand, type Hand, type Place, type Touch } from "@/components/site/hands"
import { Wordmark } from "@/components/site/wordmark"

// The hero and 01, the pieces, on one sticky stage turned by the scroll. Michelangelo's two hands, set in real letters,
// reach toward a zero made of every piece's name: Adam's hand is what you ask for, in the italic; God's is what we hand
// back, a line for every piece, in roman. Every letter takes its weight and ink from the fresco's light where it sits,
// so the fingers read (components/site/hands.ts). Point at a hand and a loupe follows over its letters, the phrase under
// it is read out in full ink, and the hands lean in as you near the zero; a line of God's hand names its piece in the
// zero, and clicking it turns there.
//
// Scroll, and the zero becomes the tunnel (01, owner's choice 2026-10-11): one ring of names per movement, the outer
// nearest, each further one smaller and a step fainter. The hands step out and the band lifts away first; then the
// same letters that stand in the zero leave it, a movement at a time, turning from their spokes to lie along their
// ring, while the disc moves aside and tips back from flat, so there is only ever one drawing, as far along as the
// scroll is. Then the
// scroll turns it, one piece per notch: the read ring brings its name round to the near edge on a settled spring, the
// other rings drift the same way, the inner ones faster, and the reading beside it changes over, the old copy leaving
// as the new one rises. Click a name, or use the arrow keys in the list, to turn to it.
//
// Everything the scroll moves is written, never read: positions are measured once per layout (on resize, when the
// fonts arrive, when the pair changes), and the scroll handler reads only scrollY, before any frame writes. A frame
// writes only transforms and opacity, each only when it changes: every ring is its own layer, turned and toned on the
// compositor, and the index dot's place is the same sum the transforms make, worked out rather than measured. Screen
// readers and keyboards get the index as a real list of links; the drawing is aria-hidden.

export type Piece = { name: string; title: string; summary: string }
export type Movement = { num: string; name: string; pieces: Piece[] }

type Flat = Piece & { mv: Movement; i: number }
type Shape = { cx: number; cy: number; ryo: number; rxo: number; ryi: number; rxi: number }
type Geometry = { W: number; H: number; m: number; bar: number; phone: boolean; hero: Shape; room: [number, number]; skip: { y: number; beside: boolean }; plate: number }
type Tab = { ls: Float64Array; L: number; steps: number }
// The tunnel, laid out once per layout: the box the disc is drawn in (S, its viewBox 800 units), where its middle
// stands, its outer radius on screen, how far it tips back, and the perspective it is seen in; and the scale it is
// drawn at while it lies flat, where the zero stands (near) and once it has moved aside (flat), so it keeps to the stage.
type Dial = { S: number; R: number; cx: number; cy: number; tilt: number; P: number; near: number; flat: number }
// A letter of a name in the tunnel: where it stands from the name's middle, in the zero (A) and on its ring (B), and
// how far it is turned from the name, on the ring; and its sprites, set and read (see Sprite).
type Letter = { el: SVGTextElement; ch: string; xA: number; yA: number; xB: number; yB: number; f: number; c: Sprite | null; b: Sprite | null }
// A letter drawn once into the sheet, for while it travels: its cell, where in the cell its anchor stands (the SVG's,
// its advance's middle and the type's central line), and how much larger than at a scale of 1 it is drawn there.
type Sprite = { x: number; y: number; w: number; h: number; ax: number; ay: number; m: number }
// A name in the tunnel, the same letters in both places: its middle (radius and angle from the disc's middle), its turn
// and its size, in the zero (A, measured from the hero's own names) and on its ring (B); `ob` is B's turn counted from A.
type Name = { g: SVGGElement; i: number; ls: Letter[]; rA: number; tA: number; oA: number; sA: number; rB: number; tB: number; oB: number; ob: number }
// A ring: its radius and size in viewBox units, its layer, its names and where along it each sits (the middle of the
// name), its dashed rule, and its turn and tone, each a value easing toward its aim. `slot` is when its names leave the
// zero; `shift` is the whole turns they travel by, so a movement's names unroll side by side and never cross (`set`
// once it is counted for this layout); `fin` holds once they have all arrived. `face` holds its letters, hidden while
// they are `flying`, when they are drawn on the canvas instead.
type Ring = { k: number; r: number; fs: number; el: SVGSVGElement; face: SVGGElement; flying: boolean; nm: Map<number, SVGGElement>; at: Map<number, number>; names: Name[]; ref: Name; rule: SVGUseElement; slot: number; shift: number; set: boolean; fin: boolean; x: number; v: number; to: number; tone: number; toneTo: number }
type Spring = { x: number; v: number; to: number }
type Tempo = { quick: number; mid: number; slow: number; step: number; breath: string; exhale: string }

const NS = "http://www.w3.org/2000/svg"
const TAU = Math.PI * 2
const RAD = Math.PI / 180
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

// The tunnel's proportions, in the disc's viewBox (800 across): the outer ring's radius and size, how much smaller each
// ring further in is set, how far it is turned from square, and each ring's tone by depth, the outer nearest.
const R0 = 360, F0 = 30, SHR = 0.84, FSH = 0.87, SPIN = -14
const DEPTH = [1, 0.84, 0.7, 0.58, 0.48, 0.4, 0.33, 0.27]
// The turn from hero to tunnel, in parts of the intro scroll (h): the hands and the band leave first, by a fifth; the
// zero's names begin to travel just after, a movement at a time, the outer first; the disc moves aside as they go and
// tips back over the last of it; the rules and the reading come in only once the rings have formed.
const MORPH = { lit: [0.01, 0.05], from: 0.1, each: 0.09, span: 0.4, aside: [0.08, 0.62], tip: [0.55, 0.37], rule: [0.8, 0.14], part: [0.86, 0.14], band: 0.16, hands: 0.2 }
// The zero's names are set in pencil, the tunnel's in graphite: as a layer's opacity, about the same grey.
const HERO_TONE = 0.8
// One stiffness for every turn, damped just short of critical, so it settles with no bounce you can count.
const K = 140, C = 2 * 0.9 * Math.sqrt(K)
// The motion tokens (registry/0nlytype/styles/tokens.css), read again at each layout; these are their values.
const TEMPO: Tempo = { quick: 160, mid: 320, slow: 640, step: 36, breath: "cubic-bezier(0.65, 0, 0.35, 1)", exhale: "cubic-bezier(0.16, 1, 0.3, 1)" }

// The reading changes over a part at a time: the current copy leaves upward as the new one rises in, a beat apart.
// One copy leaves at a time: a newer turn removes whatever was still leaving, and a copy caught halfway in leaves from
// where it is, so however fast the scroll, a box never holds more than two. Read in quick succession (under 240ms
// apart), every part changes over at once, and faster.
function swap(box: HTMLElement | null, text: string[], delay: number, fast: boolean, still: boolean, T: Tempo) {
  if (!box) return
  const cur = box.querySelector<HTMLElement>(":scope > :not(.out)"), key = text.join("\n")
  if (cur && cur.dataset.text === key) return
  for (const o of box.querySelectorAll(":scope > .out")) o.remove()
  const nu = document.createElement("span")
  nu.dataset.text = key
  for (const t of text) nu.appendChild(document.createElement("span")).textContent = t
  if (still || !cur) return box.replaceChildren(nu)
  const cs = getComputedStyle(cur), from = { transform: cs.transform === "none" ? "none" : cs.transform, opacity: cs.opacity }
  for (const a of cur.getAnimations()) a.cancel()
  cur.classList.add("out")
  cur.setAttribute("aria-hidden", "true")
  box.appendChild(nu)
  const d = fast ? 0 : delay
  cur.animate([from, { transform: "translateY(-45%)", opacity: 0 }], { duration: fast ? T.quick / 2 : T.quick, delay: d, easing: T.breath, fill: "forwards" }).finished.then(() => cur.remove(), () => {})
  nu.animate([{ transform: "translateY(55%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: fast ? T.quick + T.step : T.mid + T.quick, delay: d + (fast ? 2 : 4) * T.step, easing: T.exhale, fill: "backwards" })
}

const ASKS = ["a pricing page", "a sign-up form", "a settings screen", "an empty state", "a changelog", "a booking calendar", "a command menu", "a data table", "a page for when nothing is found", "a checkout", "a profile page", "a dashboard", "an onboarding letter", "a search page"]

// One line of the list, set again only when it becomes, or stops being, the read one or the tab stop.
const PieceLink = React.memo(function PieceLink({ q, stop, current, at }: { q: Flat; stop: boolean; current: boolean; at: (i: number, el: HTMLAnchorElement | null) => void }) {
  return (
    <li>
      <NextLink ref={(el) => at(q.i, el)} href={`/docs/${q.name}/`} prefetch={false} data-i={q.i} tabIndex={stop ? 0 : -1} aria-current={current ? "true" : undefined}>
        {pad3(q.i + 1)}. {q.title}, {q.mv.name}. {q.summary}
      </NextLink>
    </li>
  )
})

export function LandingZero({ movements, count }: { movements: Movement[]; count: number }) {
  const pieces = React.useMemo<Flat[]>(() => {
    let i = 0
    return movements.flatMap((mv) => mv.pieces.map((p) => ({ ...p, mv, i: i++ })))
  }, [movements])
  const N = pieces.length
  const starts = React.useMemo(() => movements.map((m) => pieces.findIndex((q) => q.mv === m)), [movements, pieces])
  const names = React.useMemo(() => pieces.map((q) => q.name), [pieces])
  const [sel, setSel] = React.useState(0)
  const [active, setActive] = React.useState(0)
  const [keys, setKeys] = React.useState(false)

  const section = React.useRef<HTMLElement>(null)
  const stage = React.useRef<HTMLDivElement>(null)
  const ring = React.useRef<SVGSVGElement>(null)
  const hands = React.useRef<HTMLDivElement>(null)
  const band = React.useRef<HTMLDivElement>(null)
  const part = React.useRef<HTMLDivElement>(null)
  const tunnel = React.useRef<HTMLDivElement>(null)
  const cmd = React.useRef<HTMLDivElement>(null)
  // The engine's two doors for React: turn to a piece, and say where the scroll stands.
  const api = React.useRef<{ turnTo: (i: number) => void; h: () => number }>({ turnTo: () => {}, h: () => 0 })
  // A name picked on the ring also takes the keyboard's place, so Tab and the arrows carry on from it.
  const picked = React.useRef<(i: number) => void>(() => {})
  // What the engine knows that the install line's change-over needs: the tokens, and whether the reading is quick.
  const tempo = React.useRef<Tempo>(TEMPO)
  const quick = React.useRef(false)

  React.useEffect(() => {
    const sec = section.current, st = stage.current, ringSvg = ring.current, handsEl = hands.current, bandEl = band.current, partEl = part.current, tunnelEl = tunnel.current
    if (!sec || !st || !ringSvg || !handsEl || !bandEl || !partEl || !tunnelEl) return
    const root = document.documentElement
    const motion = matchMedia("(prefers-reduced-motion: reduce)")
    let reduce = motion.matches
    const late = overtureActive() ? OVERTURE_DEADLINE - overtureLeft() : 0
    sec.style.setProperty("--late", `${Math.round(late)}ms`)

    /* ── the hero's zero: every piece's name between two ellipses ── */
    ringSvg.replaceChildren()
    const track = svg("ellipse", { class: "faint" }, ringSvg)
    const gDots = svg("g", null, ringSvg)
    const gNames = svg("g", null, ringSvg)
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
    let natural: number[] = []
    // How long each name is as set, so the callout can start where the name ends.
    const setW = names.map(() => 0)
    // What each name and dot was last set to, so a draw writes only what changed.
    const drawn = names.map(() => ({ at: "", size: "", fit: "", stretch: "", end: "", dx: "", dy: "" }))
    // Where each name stands as set (its anchor, turn and size), so the tunnel's letters can start from it.
    const pose = names.map(() => ({ x: 0, y: 0, rot: 0, f: 0 }))
    const measureNames = () => {
      for (const [i, t] of names.entries()) {
        t.setAttribute("font-size", "20")
        t.removeAttribute("textLength")
        t.setAttribute("lengthAdjust", "spacing")
        t.style.fontVariationSettings = "'wdth' 100"
        drawn[i] = { ...drawn[i], size: "", fit: "", stretch: "", end: "" }
      }
      natural = names.map((t) => t.getComputedTextLength() / 20)
    }

    /* ── geometry, measured once per layout ── */
    let G: Geometry | null = null, D: Dial | null = null
    let top = 0, intro = 1, pitch = 24, range = 1, y = scrollY
    const stageGeometry = (): Geometry => {
      const W = st.clientWidth, H = st.clientHeight, phone = W <= 760
      const m = bandEl.offsetLeft
      const bandTop = bandEl.offsetTop
      const bar = parseFloat(getComputedStyle(root).getPropertyValue("--bar")) * parseFloat(getComputedStyle(root).fontSize) || 64
      let hero: Shape
      // Where the hands may reach: under the bar, over the band. Skip intro, while the overture plays, waits in the
      // zero's counter on a wide screen; on a phone, where the zero is only the mark, it sits over the band, under the hands.
      // On a phone held sideways the room over the band is too short to give Skip intro a row of its own under the zero:
      // it stands beside it, and the hands keep that row.
      const over = bandTop - 24 - 44, beside = phone && (W > H || over < bar)
      const say = beside ? 0 : 44 + 18
      const room: [number, number] = phone ? [bar + 12, bandTop - 24 - say] : [bar + 24, bandTop - 14]
      if (phone) {
        const t = room[0], b = room[1]
        // The zero stands at the middle of the plate, not of the room left over Skip intro, which shows only once.
        hero = { cx: W / 2, cy: (bar + bandTop) / 2, ...shape(clamp((b - t) / 2 - 22, 14, 30)) }
      } else {
        // The zero is as tall as the hands are, so neither outweighs the other, and it stands in the middle of the
        // room between the bar and the band, the same air above and below.
        const t = bar + 28, b = bandTop - 28
        hero = { cx: W / 2, cy: t + (b - t) / 2, ...shape(Math.min((b - t) / 2 - 10, 300, Math.max(150, W * 0.125))) }
      }
      const skip = { y: beside ? Math.max(bar, hero.cy - 22) : phone ? over : hero.cy - 22, beside }
      // The plate the picture is printed on: from under the bar to over the band, marked at its corners and on its axis.
      const plate = bandTop - bar - 40
      return { W, H, m, bar, phone, hero, room, skip, plate }
    }
    // Where the tunnel stands. On a wide screen it owns the left and the floor, its middle at three tenths across and a
    // little under half way down, and the reading stands where its near edge points. On a phone it tips back less, and
    // it is as large as the room between the heading and the reading allows (both are placed by the CSS, and measured
    // here, once), its outer names clear of the screen's edge and the rail, and it stands in the middle of that room:
    // the near side, drawn nearer, takes more of it than the far side. A phone held sideways gives it the left half,
    // the heading and the reading the right.
    const dialGeometry = (g: Geometry): Dial => {
      const { W, H, bar, phone, hero } = g
      const fits = (R: number) => ({ near: Math.min(1, (Math.min(hero.cy - bar, H - hero.cy, hero.cx, W - hero.cx) - 12) / (R * 1.1)), flat: Math.min(1, (H - bar - 32) / (R * 2.2)) })
      if (!phone) {
        const S = Math.min(W * 0.6, (H - bar) * 1.16)
        return { S, R: 0.45 * S, cx: W * 0.3, cy: bar + (H - bar) * 0.47, tilt: 56, P: 1.33 * S, ...fits(0.45 * S) }
      }
      const tilt = 40, c = Math.cos(tilt * RAD), s = Math.sin(tilt * RAD), q = 1.33 / 0.45
      const up = (c * q) / (q + s), down = (c * q) / (q - s)
      const head = partEl.querySelector<HTMLElement>(".pieces-head"), read = partEl.querySelector<HTMLElement>(".readout"), foot = partEl.querySelector<HTMLElement>(".pieces-foot")
      const wide = W > H
      const a = wide ? bar + 8 : head ? head.offsetTop + head.offsetHeight + 14 : bar + 160
      const b = wide ? (foot ? foot.offsetTop - 8 : H - 64) : read ? read.offsetTop - 10 : H - 260
      // The outer names stand a twelfth beyond their ring; the rail keeps 24px of the right edge.
      const across = wide ? W / 2 - 16 : W - 24 - 2 * 12, cx = wide ? W / 4 : (W - 24) / 2
      const R = Math.max(60, Math.min(across / 2 / 1.08, (b - a) / (up + down)))
      return { S: R / 0.45, R, cx, cy: a + R * up + Math.max(0, b - a - R * (up + down)) / 2, tilt, P: (1.33 * R) / 0.45, ...fits(R) }
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

    /* ── drawing the hero's zero, once per layout and when a name is pointed at ── */
    // `hover` is the piece being read in the zero: the name pointed at on the ring, else the line pointed at in God's hand.
    let hover = -1, onRing = -1, onHand = -1, h = 0
    // A custom property restyles everything under the element it is set on, so each goes only to what reads it, and
    // only when it changes.
    const written = new Map<string, string>()
    const put = (el: HTMLElement | SVGElement, name: string, value: string) => {
      const k = `${el.getAttribute("class")}${name}`
      if (written.get(k) === value) return
      written.set(k, value)
      el.style.setProperty(name, value)
    }
    // A frame's transforms and opacities, each written only when it changes.
    const shown = new Map<HTMLElement | SVGElement, string>(), toned = new Map<HTMLElement | SVGElement, string>()
    const move = (el: HTMLElement | SVGElement, value: string) => {
      if (shown.get(el) === value) return
      shown.set(el, value)
      el.style.transform = value
    }
    const tone = (el: HTMLElement | SVGElement, value: string) => {
      if (toned.get(el) === value) return
      toned.set(el, value)
      el.style.opacity = value
    }
    // Where scroll timelines run, the turn from hero to dial is drawn by the scroll itself (app/landing.css); the
    // script writes its numbers only without them, or under reduced motion, where it snaps from one to the other.
    const driven = CSS.supports("animation-timeline: view()")
    const layoutRing = (g: Geometry, z: Shape) => {
      const tab = midTab(z), { cx, cy, rxo, ryo, rxi, ryi } = z
      // One size for every name, so the ring reads as one column of type turned round. A name keeps its own spacing:
      // it is condensed (the width axis, then the size) only when it would not fit between the ellipses, and it is
      // never spread to fill, so a short name reads as a word, not as letters. Each hangs from the outer rim, by its
      // dot; the counter keeps its ragged edge, as a set column does. The pieces run counterclockwise from the right, as
      // each ring of the tunnel does, so a movement's names can open into their ring without crossing.
      const fs = clamp(ryo / 30, g.phone ? 5.5 : 7, 11.5)
      for (let i = 0; i < N; i++) {
        const t = tAt(tab, -i / N), c = Math.cos(t), sn = Math.sin(t)
        const xi = cx + rxi * c, yi = cy + ryi * sn, xo = cx + rxo * c, yo = cy + ryo * sn
        const dx = xo - xi, dy = yo - yi, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len
        // A long name may reach a little into the counter, whose edge is ragged anyway, before it is condensed.
        const pad = 3, L = Math.max(4, len * 1.35 - pad * 2)
        const ang = (Math.atan2(dy, dx) * 180) / Math.PI
        const right = c >= -0.0001
        const w100 = natural[i] * fs
        const wdth = clamp((100 * L) / w100, 75, 100)
        const wAt = (w100 * wdth) / 100
        const f = wAt > L ? Math.max(4, (fs * L) / wAt) : fs
        const w = Math.min(L, wAt)
        setW[i] = w
        // On the right a name reads outward and ends at the rim; on the left it reads inward and starts there. Anchored
        // at the rim, a name set heavier (chosen, or read) grows inward, never over its dot.
        const x = xo - ux * pad, y = yo - uy * pad
        const el = names[i], was = drawn[i]
        const rot = right ? ang : ang + 180
        pose[i] = { x, y, rot, f }
        const at = `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(2)})`
        // Only a name that had to be condensed is held to its length; the rest keep their own spacing.
        const size = f.toFixed(1), fit = wAt > L ? L.toFixed(1) : "", stretch = `'wdth' ${Math.round(wdth)}`, end = right ? "end" : "start"
        if (was.at !== at) el.setAttribute("transform", (was.at = at))
        if (was.size !== size) el.setAttribute("font-size", (was.size = size))
        if (was.fit !== fit) {
          if (fit) el.setAttribute("textLength", fit)
          else el.removeAttribute("textLength")
          was.fit = fit
        }
        if (was.end !== end) el.setAttribute("text-anchor", (was.end = end))
        if (was.stretch !== stretch) el.style.fontVariationSettings = was.stretch = stretch
        el.toggleAttribute("data-sel", i === 0)
        el.toggleAttribute("data-near", i === 1 || i === N - 1)
        el.toggleAttribute("data-hover", i === hover)
        const dot = dots[i], dx2 = (cx + (rxo + 10) * c).toFixed(1), dy2 = (cy + (ryo + 10) * sn).toFixed(1)
        if (was.dx !== dx2) dot.setAttribute("cx", (was.dx = dx2))
        if (was.dy !== dy2) dot.setAttribute("cy", (was.dy = dy2))
        dot.toggleAttribute("data-sel", i === 0)
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
      if (hover >= 0) placeCallout(hover)
    }

    const placeCallout = (i: number) => {
      if (!G) return
      const z = G.hero, t = tAt(midTab(z), -i / N), c = Math.cos(t), s = Math.sin(t)
      const xi = z.cx + z.rxi * c, yi = z.cy + z.ryi * s, xo = z.cx + z.rxo * c, yo = z.cy + z.ryo * s
      const len = Math.hypot(xo - xi, yo - yi), ux = (xo - xi) / len, uy = (yo - yi) / len
      // The line leaves from where the name ends, a few points clear of its last letter.
      const back = Math.min(len, 3 + setW[i] + 5)
      const ex = z.cx + (xi - z.cx) * 0.72, ey = z.cy + (yi - z.cy) * 0.72
      callLine.setAttribute("x1", String(xo - ux * back))
      callLine.setAttribute("y1", String(yo - uy * back))
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

    /* ── 01, the tunnel: one ring of names per movement, built once per layout ── */
    // The tunnel is set from the zero's own letters: every name letter by letter, each letter its own piece of type, so
    // the letters that stand on a spoke of the zero are the ones that travel to the ring and stay there. Nothing is
    // drawn twice and nothing is handed over.
    const spinEl = tunnelEl.querySelector<HTMLElement>(".tunnel-spin")!, discEl = tunnelEl.querySelector<HTMLElement>(".tunnel-disc")!, dotEl = tunnelEl.querySelector<HTMLElement>(".tunnel-dot")!
    const groups = movements.map((m) => pieces.filter((q) => q.mv === m).map((q) => q.i))
    const ringOf = pieces.map((q) => movements.indexOf(q.mv))
    const box = (name: string) => partEl.querySelector<HTMLElement>(`[data-swap="${name}"]`)
    const nameBox = box("name"), descBox = box("desc")
    const digits = [...partEl.querySelectorAll<HTMLElement>(".ro-dg")]
    let rings: Ring[] = [], SEL = -1, T: Tempo = TEMPO
    const dotR: Spring = { x: 0, v: 0, to: 0 }
    // The index dot in the zero, from its middle (px), and how large it is there.
    let dotA = { r: 0, t: 0, d: 7 }
    // A letter set on its middle: where its middle is (mid) and its baseline (base) below that point, per unit of size.
    let mid = 0, base = 0
    // The angle that brings a point along a ring to the front: the bottom of the disc, nearest the reader.
    const front = (r: Ring, s: number) => 180 + s / r.r * (180 / Math.PI)
    const near = (cur: number, to: number) => cur + ((((to - cur) % 360) + 540) % 360) - 180
    const buildRings = () => {
      // Each name is measured once, at a hundred units, in the face the rings are set in: its length, and where the
      // middle of each letter falls along it.
      const probe = svg("svg", { class: "tunnel-ring" }, discEl), mt = svg("text", { "font-size": 100 }, probe)
      const width: number[] = [], mids: number[][] = []
      for (const q of pieces) {
        mt.textContent = q.name
        width.push(mt.getComputedTextLength() / 100)
        const o = mt.getStartPositionOfChar(0).x
        mids.push([...q.name].map((_, j) => ((mt.getStartPositionOfChar(j).x + mt.getEndPositionOfChar(j).x) / 2 - o) / 100))
      }
      mt.textContent = "x"
      const c = mt.getExtentOfChar(0)
      mt.style.dominantBaseline = "alphabetic"
      mid = (c.y + c.height / 2) / 100
      base = (c.y - mt.getExtentOfChar(0).y) / 100
      probe.remove()
      const kept = rings
      discEl.replaceChildren()
      rings = groups.map((items, k) => {
        const r = R0 * SHR ** k, len = TAU * r, id = `tunnel-path-${k}`
        const el = svg("svg", { class: "tunnel-ring", viewBox: "-400 -400 800 800" }, discEl)
        // Counterclockwise from the back: the near side reads upright, the far side upside down.
        svg("path", { id, d: `M0 ${-r}A${r} ${r} 0 1 0 0 ${r}A${r} ${r} 0 1 0 0 ${-r}` }, svg("defs", null, el))
        // A ring keeps its size unless its names would not fit in all but a twenty-fifth of it.
        const gap = 0.95, need = (f: number) => items.reduce((a, i) => a + width[i] * f, 0) + f * gap * items.length
        let fs = F0 * FSH ** k
        if (need(fs) > len * 0.96) fs *= (len * 0.96) / need(fs)
        const set = svg("g", { "font-size": fs.toFixed(2) }, el)
        const nm = new Map<number, SVGGElement>(), at = new Map<number, number>(), list: Name[] = []
        // Each letter stands upright to the circle at the middle of its own advance, its baseline on the circle, as a
        // name set on the path would; its place is kept from the name's middle, in the name's own direction.
        const rB = r - base * fs, deg = 180 / Math.PI
        let s = 0
        for (const i of items) {
          const w = width[i] * fs, g = svg("g", { class: "nm", "data-i": i }, set), sc = s + w / 2
          const tB = -90 - (sc / r) * deg, oB = tB - 90, ca = Math.cos(oB * RAD), sa = Math.sin(oB * RAD)
          const cx = rB * Math.cos(tB * RAD), cy = rB * Math.sin(tB * RAD)
          const ls = [...pieces[i].name].map((ch, j): Letter => {
            const t = svg("text", null, g), tj = -90 - ((s + mids[i][j] * fs) / r) * deg
            t.textContent = ch
            const px = rB * Math.cos(tj * RAD) - cx, py = rB * Math.sin(tj * RAD) - cy
            return { el: t, ch, xA: 0, yA: 0, xB: px * ca + py * sa, yB: py * ca - px * sa, f: tj - tB, c: null, b: null }
          })
          nm.set(i, g)
          at.set(i, sc)
          list.push({ g, i, ls, rA: 0, tA: 0, oA: 0, sA: 1, rB, tB, oB, ob: oB })
          s += w + fs * gap
        }
        // What the names leave of the ring is a dashed hairline.
        const used = s - fs * gap, dash = [0, used + fs * 0.6], seg = fs * 1.1, sp = fs * 0.8
        for (let left = len - used - fs * 1.2; left > seg; left -= seg + sp) dash.push(seg, sp)
        dash.push(0, len * 2)
        const rule = svg("use", { href: `#${id}`, class: "rule", "stroke-width": Math.max(0.6, fs / 16).toFixed(2), "stroke-dasharray": dash.map((v) => v.toFixed(1)).join(" ") }, el)
        const old = kept[k]
        return { k, r, fs, el, face: set, flying: false, nm, at, names: list, ref: list[list.length >> 1], rule, slot: 0, shift: 0, set: false, fin: false, x: 0, v: 0, to: old ? old.to : -k * 18, tone: 0, toneTo: 0 }
      })
      for (const r of rings) {
        if (r.k === ringOf[SEL]) r.to = near(r.to, front(r, r.at.get(SEL)!))
        r.x = r.to
      }
      shown.clear()
      toned.clear()
      onNm = null
      discEl.append(sprites)
    }
    // The letters on their way are drawn on one canvas over the rings, from a sheet of each ring's letters drawn once per
    // layout. SVG type whose turn and size change every frame is set again from its outlines each time, and seven
    // hundred letters of it were what made the turn stutter. Landed, the letters are the SVG's again, at the same pose
    // in the same frame, so the names stay pointable and read by assistive technology.
    const sprites = document.createElement("canvas"), pen = sprites.getContext("2d"), sheet = document.createElement("canvas")
    sprites.className = "tunnel-sprites"
    sprites.setAttribute("aria-hidden", "true")
    // The canvas reaches a tenth of the disc past each edge (app/landing.css), so a name set outside the disc still
    // shows; `kU` is its pixels to a unit of the disc and `c0` its middle. `drew` holds while it has letters on it.
    const OVER = 1.2
    let kU = 1, c0 = 0, drew = false
    // Each ring's letters, set and read, in its face and inks as styled, a little sharper than the canvas needs where a
    // name in the zero is set larger than on its ring. Once per layout, after the fonts, the pair and the mode.
    const drawSheet = () => {
      const S = D?.S ?? 0, dpr = devicePixelRatio || 1, ink = sheet.getContext("2d")
      const side = Math.max(1, Math.round(S * OVER * dpr * Math.min(1.25, 4096 / (S * OVER * dpr))))
      sprites.width = sprites.height = side
      kU = side / (800 * OVER)
      c0 = side / 2
      drew = false
      if (!pen || !ink || !rings.length) return
      const first = rings[0].names[0].ls[0].el, css = getComputedStyle(first), family = css.fontFamily
      // The read name's weight and ink, as its letters compute them, so the sheet draws what the SVG does.
      const probe = svg("text", null, svg("g", { class: "nm on" }, rings[0].face)), on = getComputedStyle(probe)
      const looks = { c: { w: css.fontWeight, fill: css.fill }, b: { w: on.fontWeight, fill: on.fill } }
      probe.parentElement?.remove()
      // Canvas takes a width only by its keyword: semi-condensed is the 87.5% the rings are set in.
      const font = (w: string, px: number) => `${w} semi-condensed ${px.toFixed(2)}px ${family}`
      type Job = { p: Sprite; ch: string; look: "c" | "b"; px: number; bx: number; by: number }
      const jobs: Job[] = [], pad = 2, SW = 2048
      let x = 0, y = 0, row = 0
      ink.textAlign = "center"
      ink.textBaseline = "alphabetic"
      for (const r of rings) {
        const m = clamp(Math.max(...r.names.map((n) => n.sA)), 1, 2), px = r.fs * kU * m
        for (const look of ["c", "b"] as const) {
          ink.font = font(looks[look].w, px)
          const got = new Map<string, Sprite | null>()
          for (const n of r.names)
            for (const l of n.ls) {
              if (!got.has(l.ch)) {
                const t = ink.measureText(l.ch), L = t.actualBoundingBoxLeft, R = t.actualBoundingBoxRight, A = t.actualBoundingBoxAscent
                let p: Sprite | null = null
                if (l.ch.trim() && L + R > 0) {
                  const cw = Math.ceil(L + R) + 2 * pad, ch = Math.ceil(A + t.actualBoundingBoxDescent) + 2 * pad
                  if (x + cw > SW) [x, y, row] = [0, y + row, 0]
                  p = { x, y, w: cw, h: ch, ax: pad + L, ay: pad + A - base * px, m }
                  jobs.push({ p, ch: l.ch, look, px, bx: x + pad + L, by: y + pad + A })
                  x += cw
                  row = Math.max(row, ch)
                }
                got.set(l.ch, p)
              }
              l[look] = got.get(l.ch)!
            }
        }
      }
      sheet.width = SW
      sheet.height = Math.max(1, y + row)
      ink.textAlign = "center"
      ink.textBaseline = "alphabetic"
      for (const j of jobs) {
        ink.font = font(looks[j.look].w, j.px)
        ink.fillStyle = looks[j.look].fill
        ink.fillText(j.ch, j.bx, j.by)
      }
      pen.imageSmoothingQuality = "high"
    }
    // Where every letter stands in the zero, taken from the zero's own names as set (each letter's middle, less where a
    // letter set on its middle has it), as seen from the zero's middle, in the disc's units. Once per layout.
    const capture = () => {
      if (!G || !D) return
      const z = G.hero, u = 800 / (D.S * D.near)
      for (const r of rings)
        for (const n of r.names) {
          const p = pose[n.i], a = p.rot * RAD, ca = Math.cos(a), sa = Math.sin(a), el = names[n.i]
          const pts = n.ls.map((_, j) => {
            const e = el.getExtentOfChar(j), lx = e.x + e.width / 2, ly = e.y + e.height / 2 - mid * p.f
            return [p.x + lx * ca - ly * sa - z.cx, p.y + lx * sa + ly * ca - z.cy]
          })
          const a0 = pts[0], a1 = pts[pts.length - 1], cx = (a0[0] + a1[0]) / 2, cy = (a0[1] + a1[1]) / 2
          Object.assign(n, { rA: Math.hypot(cx, cy) * u, tA: Math.atan2(cy, cx) / RAD, oA: p.rot, sA: (p.f * u) / r.fs })
          n.ls.forEach((l, j) => {
            const dx = (pts[j][0] - cx) * u, dy = (pts[j][1] - cy) * u
            l.xA = dx * ca + dy * sa
            l.yA = dy * ca - dx * sa
          })
          r.fin = r.set = false
        }
      // The rings furthest from the zero's own size leave first, outward and inward at once: the outer ones out past
      // the zero, the inner ones into its empty counter, each clear of the next before it comes, so none passes another.
      const all = rings.flatMap((r) => r.names), mean = all.reduce((a, n) => a + n.rA, 0) / all.length
      for (const side of [rings.filter((r) => r.r >= mean), rings.filter((r) => r.r < mean)])
        side.sort((a, b) => Math.abs(b.r - mean) - Math.abs(a.r - mean)).forEach((r, j) => (r.slot = j))
      // The accent: beside the read name on a wide screen, in the mark's counter on a phone.
      const px = clamp((z.ryo - 50) / 70) >= 0.5 ? z.rxo + 10 : 0
      dotA = { r: px / D.near, t: 0, d: px ? 7 : 0.28 * z.ryo }
    }
    // A turn: the read ring brings the name round to the front by the shorter way; the rest drift the same way, the
    // inner ones faster, a vortex, never a jump.
    const aim = (prev: number) => {
      const kr = ringOf[SEL], d = SEL - prev
      for (const r of rings) {
        if (r.k === kr) r.to = near(r.to, front(r, r.at.get(SEL)!))
        else r.to += -d * (1.6 + r.k * 0.55)
      }
    }
    // The reading: the movement, the number on its own wheels, the name, what it is for; the install line follows in
    // React. Tone lives in each ring's opacity: the read ring comes forward, the rest keep their depth a step back.
    let lastRead = 0, onNm: SVGGElement | null = null
    const read = (still: boolean) => {
      const q = pieces[SEL], k = ringOf[SEL], now = performance.now(), fast = now - lastRead < 240, calm = still || reduce
      lastRead = now
      quick.current = fast
      const n = pad3(SEL + 1)
      let lead = true
      digits.forEach((d, j) => {
        if (n[j] !== "0") lead = false
        d.toggleAttribute("data-lead", lead && j < 2)
        const col = d.firstElementChild as HTMLElement
        col.style.transition = calm ? "none" : ""
        col.style.transitionDelay = fast ? "0ms" : `${(2 - j) * T.step}ms`
        col.style.transform = `translateY(${-Number(n[j])}em)`
      })
      swap(nameBox, [q.title], T.step, fast, calm, T)
      swap(descBox, [q.summary], 2.5 * T.step, fast, calm, T)
      onNm?.classList.remove("on")
      onNm = rings[k]?.nm.get(SEL) ?? null
      onNm?.classList.add("on")
      for (const r of rings) {
        r.toneTo = r.k === k ? 1 : DEPTH[Math.min(DEPTH.length - 1, r.k + 1)]
        if (calm) r.tone = r.toneTo
      }
      if (rings[k]) dotR.to = rings[k].r + rings[k].fs * 0.9
      if (calm) dotR.x = dotR.to
      setSel(SEL)
    }
    const select = (i: number) => {
      const prev = SEL
      SEL = i
      aim(prev)
      read(false)
    }
    // How far a movement's names have travelled from the zero to their ring, in its turn.
    const travelled = (r: Ring) => clamp((h - MORPH.from - MORPH.each * r.slot) / MORPH.span)
    // Each name goes out (or in) to its ring's radius, growing or shrinking to its size there, while still on its spoke;
    // then it swings round to its place and, a little behind, turns from lying along its spoke to lying along the circle.
    // They shrink as they go, to half at the middle of the way, so names crossing the zero's band slip past each other.
    const stages = (u: number) => {
      const pa = smooth(clamp((u - 0.2) / 0.6))
      return { pr: smooth(clamp(u / 0.45)), pa, ro: smooth(clamp((pa - 0.15) / 0.85)), dip: 1 - 0.5 * Math.sin(Math.PI * clamp(u)) }
    }
    // One ring's names on their way, u from 0 (the zero) to 1 (the ring). Angles are counted on from where each name
    // starts, the same whole turns for a whole movement, so its names unroll side by side and never cross.
    // On its way a ring's names are drawn on the canvas, at `a`, its tone; landed, they are its own letters again.
    const unroll = (r: Ring, u: number, a: number) => {
      const ink = u < 1 ? pen : null
      if (r.flying !== !!ink) {
        r.flying = !!ink
        r.face.style.visibility = ink ? "hidden" : ""
      }
      if (u >= 1 && r.fin) return
      const { pr: ps, pa, ro, dip } = stages(u)
      // Counted afresh only while the names stand still, at either end, so a turn of the ring never moves them mid-way.
      if (!r.set || u <= 0 || u >= 1 || r.fin) {
        r.set = true
        r.shift = 360 * Math.round((r.ref.tA - r.x - r.ref.tB) / 360)
        for (const n of r.names) {
          const travel = n.tB + r.shift - (n.tA - r.x)
          n.ob = n.oB + 360 * Math.round((n.oA - r.x + travel - n.oB) / 360)
        }
      }
      r.fin = u >= 1
      // On the canvas a letter is turned with its ring, as the ring's own layer turns it, and drawn from its middle
      // (the SVG's anchor) at the pose the SVG would take.
      const rc = Math.cos(r.x * RAD), rs = Math.sin(r.x * RAD)
      if (ink) ink.globalAlpha = a
      for (const n of r.names) {
        const t = lerp(n.tA - r.x, n.tB + r.shift, pa) * RAD, rho = lerp(n.rA, n.rB, ps), o = lerp(n.oA - r.x, n.ob, ro)
        const cx = rho * Math.cos(t), cy = rho * Math.sin(t), ca = Math.cos(o * RAD), sa = Math.sin(o * RAD), sc = lerp(n.sA, 1, ps) * dip, on = n.g === onNm
        for (const l of n.ls) {
          const lx = lerp(l.xA, l.xB, ps), ly = lerp(l.yA, l.yB, ro), X = cx + lx * ca - ly * sa, Y = cy + lx * sa + ly * ca, deg = o + l.f * ro
          if (!ink) {
            move(l.el, `translate(${X.toFixed(2)}px, ${Y.toFixed(2)}px) rotate(${deg.toFixed(2)}deg) scale(${sc.toFixed(3)})`)
            continue
          }
          const p = on ? l.b : l.c
          if (!p) continue
          const g = sc / p.m, f = (r.x + deg) * RAD, gc = g * Math.cos(f), gs = g * Math.sin(f)
          ink.setTransform(gc, gs, -gs, gc, c0 + kU * (X * rc - Y * rs), c0 + kU * (X * rs + Y * rc))
          ink.drawImage(sheet, p.x, p.y, p.w, p.h, -p.ax, -p.ay, p.w, p.h)
        }
      }
      if (ink) drew = true
    }
    // One frame of the turn from hero to tunnel, and of the tunnel's own turning. The disc starts where the zero stands
    // and moves aside to its own place, lying flat as the zero did and tipping back as the last rings form; the zero's
    // drawing gives way to its own letters where they stand, in the first notch of the scroll.
    const turn = () => {
      if (!G || !D) return
      const lit = smooth(clamp((h - MORPH.lit[0]) / MORPH.lit[1]))
      const e = smooth(clamp((h - MORPH.aside[0]) / MORPH.aside[1])), tip = smooth(clamp((h - MORPH.tip[0]) / MORPH.tip[1]))
      const dx = (G.hero.cx - D.cx) * (1 - e), dy = (G.hero.cy - D.cy) * (1 - e)
      // Lying flat it would stand taller than the stage, so it keeps to the stage's height until it tips back.
      const spin = SPIN * tip, tilt = D.tilt * tip, fit = lerp(lerp(D.near, D.flat, e), 1, tip), ruled = smooth(clamp((h - MORPH.rule[0]) / MORPH.rule[1]))
      tone(ringSvg, (1 - lit).toFixed(3))
      move(spinEl, `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) rotate(${spin.toFixed(3)}deg) scale(${fit.toFixed(4)})`)
      move(discEl, `perspective(${D.P.toFixed(0)}px) rotateX(${tilt.toFixed(3)}deg)`)
      // The canvas is drawn afresh while any names are on their way, and cleared once when the last of them lands.
      if (pen && (drew || (lit > 0 && rings.some((r) => travelled(r) < 1)))) {
        pen.setTransform(1, 0, 0, 1, 0, 0)
        pen.clearRect(0, 0, sprites.width, sprites.height)
        drew = false
      }
      for (const r of rings) {
        const u = travelled(r), a = lit * lerp(HERO_TONE, r.tone, smooth(u))
        move(r.el, `rotate(${r.x.toFixed(3)}deg)`)
        tone(r.el, a.toFixed(3))
        tone(r.rule, (0.5 * ruled).toFixed(3))
        if (lit > 0) unroll(r, u, a)
      }
      // The index dot travels with the read name, the same way round, from beside it in the zero to the read ring's near
      // edge: the turn, the perspective's divide, then the turn from square, the same sum the transforms make, worked
      // out, never measured.
      const rr = rings[ringOf[SEL]], n = rr?.names.find((m) => m.i === SEL), u = rr ? travelled(rr) : 1, { pr, pa } = stages(u)
      const tB = rr && n ? n.tB + rr.shift + rr.x : 90, t = lerp(dotA.t, tB, pa) * RAD, rho = lerp(dotA.r, (dotR.x * D.S) / 800, pr)
      const lx = rho * Math.cos(t), ly = rho * Math.sin(t), th = tilt * RAD, kz = (fit * D.P) / (D.P - ly * Math.sin(th)), X = lx * kz, Y = ly * Math.cos(th) * kz, a = spin * RAD
      move(dotEl, `translate(${(D.cx + dx + X * Math.cos(a) - Y * Math.sin(a)).toFixed(2)}px, ${(D.cy + dy + X * Math.sin(a) + Y * Math.cos(a)).toFixed(2)}px) scale(${lerp(dotA.d / 9, 1, pr).toFixed(3)})`)
      tone(dotEl, lit.toFixed(3))
    }
    const layoutTunnel = (g: Geometry) => {
      const d = (D = dialGeometry(g))
      spinEl.style.cssText = `left:${(d.cx - d.S / 2).toFixed(1)}px;top:${(d.cy - d.S / 2).toFixed(1)}px;width:${d.S.toFixed(1)}px;height:${d.S.toFixed(1)}px`
      const css = getComputedStyle(root), ms = (n: string, v: number) => parseFloat(css.getPropertyValue(n)) || v, ease = (n: string, v: string) => css.getPropertyValue(n).trim() || v
      T = tempo.current = { quick: ms("--ot-allegro", 160), mid: ms("--ot-moderato", 320), slow: ms("--ot-andante", 640), step: ms("--ot-arpeggio", 36), breath: ease("--ot-breath", TEMPO.breath), exhale: ease("--ot-exhale", TEMPO.exhale) }
      buildRings()
      capture()
      drawSheet()
      read(true)
    }

    /* ── the hands: Michelangelo's, set in real letters on two canvases (components/site/hands.ts) ── */
    const canvases = Array.from(handsEl.children) as HTMLCanvasElement[]
    // Adam's hand is what you ask for, in the italic; God's is what we hand back, in roman.
    const streams = [ASKS.map((a) => `Build me ${a} in 0nlyType.`).join(" ") + " ", pieces.map((p) => `add ${p.name}`).join(" · ") + " · "]
    let set: Hand[] = [], grid: Uint8Array | null = null, version = 0, rise = 0, rising = false, entered = overtureActive()
    const touch: Touch[] = [0, 1].map(() => ({ x: 0, y: 0, r: 64, s: 0, grow: 0.6, lit: -1, litA: 0, was: -1, wasA: 0, dim: 0 }))
    // God's lines name pieces: "add calendar" is the calendar's phrase, both ways.
    let pieceOf: number[] = [], phraseOf = new Map<number, number>()
    const paint = (t = Infinity) => {
      set.forEach((hand, i) => drawHand(canvases[i], hand, t, 700, 520, t === Infinity ? touch[i] : undefined))
      // A canvas shows nothing a page can read, so the hands say what they show: drawn, and still rising or settled.
      handsEl.setAttribute("data-drawn", "")
      handsEl.toggleAttribute("data-rising", t !== Infinity)
    }
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
    // Without the overture (a visitor who has seen it), the hands still enter so, once a load, on their own clock: the
    // first time they are set, never on a resize or a retune after. A key or a press does not cut this one short; the
    // hands take only as long to arrive as the overture would have given them.
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
      // A load enters once: with the overture on its clock, or by itself when there is none. A load the overture was
      // already playing for has had its entrance, even if it ended before the hands were set; a load that opens below
      // the top (a link to a part of the page, a restored scroll) arrives settled.
      const own = !overtureActive()
      if (reduce || (own && (entered || scrollY > 4))) return settle()
      entered = rising = true
      const start = own ? performance.now() : performance.now() - Math.max(0, RUN - overtureLeft())
      // On a machine slow enough that a frame of the rise takes most of a frame, the next is set only after as long
      // again has passed, so the rise never holds more than half the page's time and the keys and presses that end the
      // overture still find it free. A fast machine sets every frame.
      let free = 0
      const frame = (now: number) => {
        const t = now - start
        if (t >= RUN || (!own && !overtureActive())) return settle()
        if (performance.now() < free) {
          rise = requestAnimationFrame(frame)
          return
        }
        const e = (1 - Math.min(1, t / RUN)) ** 3
        canvases[0].style.transform = `translateX(${(-e * shift).toFixed(1)}px)`
        canvases[1].style.transform = `translateX(${(e * shift).toFixed(1)}px)`
        const at = performance.now()
        paint(t)
        const took = performance.now() - at
        free = took > 12 ? performance.now() + took : 0
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

    // Skip intro, while the overture plays, waits in the zero (over the band, on a phone). The CSS has it on the axis
    // before this runs; this sets it to the pixel, from the band it is placed in.
    const placeSkip = (g: Geometry) => {
      const skip = bandEl.querySelector<HTMLElement>(".hero-skip")
      if (!skip) return
      const x = g.skip.beside ? g.hero.cx + g.hero.rxo + 16 : g.hero.cx - skip.offsetWidth / 2
      skip.style.left = `${(x - bandEl.offsetLeft - bandEl.clientLeft).toFixed(1)}px`
      skip.style.top = `${(g.skip.y - bandEl.offsetTop - bandEl.clientTop).toFixed(1)}px`
      skip.style.transform = "none"
    }


    /* ── the scroll: the hands fall away, the zero opens into the tunnel, then the tunnel turns ── */
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
      placeSkip(G)
      put(bandEl, "--plate", `${G.plate.toFixed(0)}px`)
      void setHands(G)
      layoutRing(G, G.hero)
      if (SEL < 0) SEL = clamp(Math.round(target().raw), 0, N - 1)
      layoutTunnel(G)
      key = ""
      render(true)
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
      if (!G || !D) return
      const k = h.toFixed(4)
      if (force || k !== key) {
        key = k
        const out = clamp(h / MORPH.band), inn = smooth(clamp((h - MORPH.part[0]) / MORPH.part[1]))
        const scripted = !driven || reduce
        put(handsEl, "--h", scripted ? h.toFixed(4) : "")
        put(bandEl, "--out", scripted ? out.toFixed(3) : "")
        put(partEl, "--inn", scripted ? inn.toFixed(3) : "")
        st.toggleAttribute("data-dial", h >= 0.9)
        st.toggleAttribute("data-hero", h < MORPH.from)
      }
      turn()
    }

    // The scroll sets which piece is read; the rings follow it on springs and settle, never jump. The handing over from
    // the zero is as far along as the scroll is.
    const step = (s: Spring, dt: number) => {
      if (reduce) {
        s.x = s.to
        s.v = 0
        return false
      }
      s.v += (-K * (s.x - s.to) - C * s.v) * dt
      s.x += s.v * dt
      if (Math.abs(s.x - s.to) > 0.01 || Math.abs(s.v) > 0.01) return true
      s.x = s.to
      s.v = 0
      return false
    }
    let raf = 0, last = 0
    const tick = (now: number) => {
      raf = 0
      const dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60
      last = now
      const T_ = target()
      h = reduce ? (T_.h >= 0.5 ? 1 : 0) : T_.h
      const s = clamp(Math.round(T_.raw), 0, N - 1)
      if (SEL >= 0 && rings.length && s !== SEL) select(s)
      let busy = false
      for (const r of rings) {
        busy = step(r, dt) || busy
        // The tone eases toward its aim over andante, on the same frames.
        if (r.tone !== r.toneTo) {
          r.tone = reduce || Math.abs(r.tone - r.toneTo) < 0.004 ? r.toneTo : r.toneTo + (r.tone - r.toneTo) * Math.exp((-3000 * dt) / T.slow)
          busy = true
        }
      }
      busy = step(dotR, dt) || busy
      render()
      if (busy) raf = requestAnimationFrame(tick)
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

    // Pointing at a name in the hero's zero reads it there; clicking (or tapping) one turns to it in the tunnel.
    const hit = (ev: PointerEvent | MouseEvent) => {
      if (!G || h > MORPH.lit[0]) return -1
      const z = G.hero, b = ringSvg.getBoundingClientRect()
      const u = (ev.clientX - b.left - z.cx) / ((z.rxo + z.rxi) / 2), w = (ev.clientY - b.top - z.cy) / ((z.ryo + z.ryi) / 2)
      const r = Math.hypot(u, w)
      if (z.ryo < 50 || r < 0.62 || r > 1.32) return -1
      return mod(Math.round(-fAt(midTab(z), Math.atan2(w, u)) * N), N)
    }
    const point = () => {
      const i = onRing >= 0 ? onRing : onHand
      if (i === hover) return
      hover = i
      ringSvg.toggleAttribute("data-pointing", i >= 0)
      if (i < 0) gCall.setAttribute("visibility", "hidden")
      if (G) layoutRing(G, G.hero)
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
    // The focus first: from the hero, focusing the list turns to the piece it last held, and the turn to this one must
    // come after it.
    const turnTo = (i: number) => {
      picked.current(i)
      scrollToPiece(i)
    }
    const onClick = (ev: MouseEvent) => {
      const at = hit(ev), i = at >= 0 ? at : onHand
      if (i >= 0) turnTo(i)
    }
    // A name in the tunnel turns to itself.
    const onPick = (ev: MouseEvent) => {
      const i = Number((ev.target as Element).closest?.(".nm[data-i]")?.getAttribute("data-i") ?? NaN)
      if (Number.isInteger(i)) turnTo(i)
    }
    ringSvg.addEventListener("pointermove", onMove)
    ringSvg.addEventListener("pointerleave", onLeave)
    ringSvg.addEventListener("click", onClick)
    tunnelEl.addEventListener("click", onPick)
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
      // The hands settle on the next frame, not in the end itself, so the key or press that ended it is answered first.
      cancelAnimationFrame(rise)
      rise = requestAnimationFrame(() => play())
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
      tunnelEl.removeEventListener("click", onPick)
      removeEventListener("scroll", onScroll)
      removeEventListener("resize", onResize)
      motion.removeEventListener("change", onMotion)
      offOverture()
      cancelAnimationFrame(rise)
      cancelAnimationFrame(felt)
      pair.disconnect()
    }
  }, [movements, pieces, N])

  // The install line changes over with the rest of the reading: React sets its words, and the piece's name rises in.
  const firstCmd = React.useRef(true)
  React.useEffect(() => {
    const name = cmd.current?.querySelector<HTMLElement>(".copy-cmd-text i")
    if (firstCmd.current || !name || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      firstCmd.current = false
      return
    }
    const T = tempo.current, fast = quick.current
    for (const a of name.getAnimations()) a.cancel()
    name.animate([{ transform: "translateY(55%)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: fast ? T.quick + T.step : T.mid + T.quick, delay: fast ? 2 * T.step : 8 * T.step, easing: T.exhale, fill: "backwards" })
  }, [sel])

  // The list is the keyboard's dial: one stop in the tab order, the arrows turn it, Enter opens the piece.
  const links = React.useRef<(HTMLAnchorElement | null)[]>([])
  const at = React.useCallback((i: number, el: HTMLAnchorElement | null) => {
    links.current[i] = el
  }, [])
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
        <div ref={tunnel} className="zero-tunnel" aria-hidden="true">
          <div className="tunnel-spin">
            <div className="tunnel-disc" />
          </div>
          <span className="tunnel-dot" />
        </div>

        <div ref={band} className="hero-band" onFocus={() => api.current.h() > 0 && scrollTo({ top: 0, behavior: "auto" })}>
          <span className="hero-plate" aria-hidden="true" />
          <Wordmark id="hero-title" className="hero-mark" />
          <div className="hero-side">
            <p className="hero-count">
              <span className="hero-n">{count}</span> <span className="hero-what">React components, set in words, for the shadcn CLI.</span>
            </p>
            <span className="hero-cta">
              <DocsField href="/docs/" names={names} />
            </span>
            <div className="hero-install">
              <CopyCommand command={install("button")} emphasis="button" />
            </div>
          </div>
          <Overture />
        </div>

        <div ref={part} className="pieces-part" onFocus={into}>
          <div className="pieces-sheet">
            <div className="pieces-head">
              <h2 className="pieces-title" id="pieces">
                {count} pieces.
                <br />
                Turn to one.
              </h2>
            </div>
            <PiecePreview item={p.name} />
            <div className="readout">
              <div className="ro-row">
                <p className="ro-num" aria-hidden="true">
                  {[0, 1, 2].map((j) => (
                    <span key={j} className="ro-dg">
                      <i>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                          <b key={d}>{d}</b>
                        ))}
                      </i>
                    </span>
                  ))}
                </p>
                <div className="ro-body">
                  <p className="ro-name ro-swap" data-swap="name" />
                  <p className="ro-desc ro-swap" data-swap="desc" />
                </div>
              </div>
              <div ref={cmd} className="ro-cmd">
                <CopyCommand command={install(p.name)} emphasis={p.name} />
              </div>
            </div>
          </div>
          <p className="pieces-keys" aria-hidden="true">
            Arrow keys turn it. Enter opens the piece.
          </p>
          <div className="pieces-foot">
            <nav className="pieces-groups" aria-label="Movements">
              {movements.map((m, k) => (
                <button key={m.num} type="button" className="pieces-group" aria-current={m === p.mv ? "true" : undefined} onClick={() => api.current.turnTo(starts[k])}>
                  <span className="pieces-group-num">{m.num}</span> <span className="pieces-group-name">{m.name}</span>
                </button>
              ))}
            </nav>
            <p className="pieces-skip">
              <a className="ot-link" href="#leaves">
                Skip the index
              </a>
              <NextLink className="ot-link" href="/docs/">
                Every piece as a list
              </NextLink>
            </p>
          </div>
          <nav className="pieces-nav" aria-label="Every piece">
            <ol
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
                <PieceLink key={q.name} q={q} stop={q.i === tabStop} current={q.i === sel} at={at} />
              ))}
            </ol>
          </nav>
        </div>
      </div>
    </section>
  )
}
