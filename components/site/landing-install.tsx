"use client"

import { registryURL } from "@/lib/site/config.mjs"
import NextLink from "next/link"
import * as React from "react"

import { glyphSheet, type Glyph, type GlyphSheet } from "@/components/site/glyph-sheet"
import { Sec } from "@/components/site/landing-section"
import { breath, span, useStage, type Frame } from "@/components/site/stage"
import { advances } from "@/components/site/type-shapes"
import { CommandLine } from "@/registry/0nlytype/ui/command-line"
import { Link } from "@/registry/0nlytype/ui/link"

// 04, the line that installs it. Above the empty command line hangs a tangle of string, and the string is made of fine
// type: what other libraries make you carry, as one run-on ("a package · a wrapper · a theme provider · …"), every
// letter turned to the curve it rides. The tangle is a ball of loose wraps seen in depth: the near strands in ink, the
// far ones in pencil, and where a near strand crosses a far one the far one breaks, as an engraver breaks a line that
// passes under. Its loose end lies just over the line.
//
// The scroll pulls it taut. The section holds still while you scroll, and the string straightens from its loose end
// along the command line's baseline, left to right, the way a pulled thread goes taut from the hand: each point of it
// leaves the tangle a little after the one before, so the unknotting travels along the string. Where the string lies
// straight, its words give way to the command's own letters in their own places, and at the end the drawing hands
// over to the real line, which is copyable throughout: "One line." is literally what is left. The drawing is a pure
// function of the scroll, so scrolling up ties the knot again. The pointer can tug the strands aside; they spring
// back and are still within a second and a half. Reduced motion shows the plain section: the line, no tangle.
//
// Everything the drawing needs is set once per layout (the tangle, the text's advances, the command's letter boxes);
// a frame only moves points, lays glyphs along them and draws.

const BURDEN = "a package · a wrapper · a theme provider · a peer dependency · an update · a breaking change · a migration guide · a config file · a plugin · a lockfile conflict · a version to pin · a changelog to read · a build step · a style to override · a provider around the app · a fork to keep · an issue to wait on · "

/** A glyph of the command as the page sets it: its centre on the line, where along the final string it sits, and how to set it. */
type Slot = { g: string; x: number; y: number; u: number; font: string; color: string; sx: number }
/** A slot with its letter cut onto the sheet. */
type Cut = Slot & { sp: Glyph }

type Laid = {
  /** Points of the string: in the tangle (kx, ky, kz) and laid straight on the command line (fx, fy). */
  n: number
  kx: Float32Array
  ky: Float32Array
  kz: Float32Array
  fx: Float32Array
  fy: Float32Array
  /** The working string, this frame. */
  x: Float32Array
  y: Float32Array
  z: Float32Array
  q: Float32Array
  len: Float32Array
  glyphs: { g: string; w: number }[]
  /** The run-on's whole length, so it is laid from the string's far end and the tangle's letters never slide. */
  textLen: number
  fs: number
  fonts: [string, string, string]
  slots: Cut[]
  /** Every letter of the run-on, cut once per layout in each of the three depths' faces and inks (index glyph * 3 + depth), and the command's own. */
  sheet: GlyphSheet
  cut: Glyph[]
  /** Scroll, in the run's top relative to the window: where the pull begins and where it is done. */
  from: number
  to: number
  /** The tangle's middle height, which it is drawn flat towards as it tightens. */
  cy: number
  sec: HTMLElement
  /** The command's opacity as last written, so it is written only when it changes. */
  land: number
}

const W = 0.4 // how much of the string is in motion at once
const DRAW = 0.6 // how far the whole tangle is drawn flat as the string tightens, before each point leaves it
const LIFT = 0.6 // past this, a point is near enough the line that its words give way to the command's letters

const mulberry = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * The tangle, as a 3-d curve projected flat: loose wraps round a ball whose axis drifts as it winds, each wrap pushed
 * in and out by slow noise, so the wraps cross at every angle like string wound by hand. Returns x, y in the box and
 * z from -1 (far) to 1 (near).
 */
function tangle(cx: number, cy: number, rx: number, ry: number, wraps: number, seed: number) {
  const rnd = mulberry(seed), steps = Math.round(wraps * 160)
  const ph = Array.from({ length: 9 }, () => rnd() * Math.PI * 2)
  const out: number[] = []
  for (let k = 0; k <= steps; k++) {
    const t = (k / steps) * wraps * Math.PI * 2
    // The axis the string winds round tips and turns as it goes.
    const a = 0.9 * t / wraps * 2.3 + ph[0], b = 0.37 * t + ph[1]
    const r = 1 + 0.16 * Math.sin(0.53 * t + ph[2]) + 0.09 * Math.sin(1.71 * t + ph[3]) - 0.05 * Math.sin(3.1 * t + ph[8])
    // A circle in the plane of (e1, e2), the plane turned by a and b.
    const c = Math.cos(t), s = Math.sin(t), ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b)
    let px = c * ca - s * sa * cb, py = c * sa + s * ca * cb, pz = s * sb
    // Slow noise, so it is a tangle and not a gyroscope.
    px += 0.14 * Math.sin(0.8 * t + ph[4]); py += 0.12 * Math.sin(1.13 * t + ph[5]); pz += 0.1 * Math.sin(0.67 * t + ph[6])
    out.push(cx + px * r * rx, cy + py * r * ry, Math.max(-1, Math.min(1, pz * r)))
  }
  return out
}

/** A cubic from p0 to p3, appended as 3-d points with z eased from z0 to z3. */
function cubic(out: number[], p0: number[], p1: number[], p2: number[], p3: number[], steps: number) {
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, m = 1 - t
    const b0 = m * m * m, b1 = 3 * m * m * t, b2 = 3 * m * t * t, b3 = t * t * t
    out.push(b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0], b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1], b0 * p0[2] + b1 * p1[2] + b2 * p2[2] + b3 * p3[2])
  }
}

/** Resamples a polyline of `stride`-wide points to `n` points evenly spaced along it. */
function resample(pts: number[], stride: number, n: number) {
  const m = pts.length / stride, acc = new Float64Array(m)
  for (let i = 1; i < m; i++) acc[i] = acc[i - 1] + Math.hypot(pts[i * stride] - pts[(i - 1) * stride], pts[i * stride + 1] - pts[(i - 1) * stride + 1])
  const L = acc[m - 1], out = Array.from({ length: stride }, () => new Float32Array(n))
  let j = 0
  for (let i = 0; i < n; i++) {
    const s = (i / (n - 1)) * L
    while (j < m - 2 && acc[j + 1] < s) j++
    const d = acc[j + 1] - acc[j], t = d ? (s - acc[j]) / d : 0
    for (let c = 0; c < stride; c++) out[c][i] = pts[j * stride + c] + (pts[(j + 1) * stride + c] - pts[j * stride + c]) * t
  }
  return { out, L }
}

/**
 * The command as the page sets it, glyph by glyph, in the canvas's coordinates: where each letter's middle stands on
 * its baseline, its face and ink, and the straight string it lies on (a run along each line it wraps to).
 */
function readLine(sec: HTMLElement, cv: HTMLCanvasElement) {
  const code = sec.querySelector<HTMLElement>(".ot-command-line-text")
  if (!code) return null
  const box = cv.getBoundingClientRect(), range = document.createRange()
  const walk = document.createTreeWalker(code, NodeFilter.SHOW_TEXT)
  const raw: { g: string; x: number; top: number; w: number; base: number; font: string; color: string; sx: number }[] = []
  for (let node = walk.nextNode() as Text | null; node; node = walk.nextNode() as Text | null) {
    const el = node.parentElement!, cs = getComputedStyle(el)
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const text = node.data
    for (let i = 0; i < text.length; i++) {
      const g = text[i]
      if (/\s/.test(g)) continue
      range.setStart(node, i); range.setEnd(node, i + 1)
      const r = range.getBoundingClientRect()
      if (!r.width) continue
      const m = (measureCtx().font = font, measureCtx().measureText(g))
      raw.push({ g, x: r.left - box.left + r.width / 2, top: r.top - box.top, w: r.width, base: r.top - box.top + m.fontBoundingBoxAscent, font, color: cs.color, sx: m.width ? r.width / m.width : 1 })
    }
  }
  if (!raw.length) return null
  // Lines, by where each glyph's box starts; the baseline of a line is its first roman glyph's.
  const lines: { y: number; a: number; b: number }[] = []
  for (const r of raw) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(r.base - last.y) < r.w * 1.6 + 4 && r.x > last.b - r.w) last.b = r.x + r.w / 2
    else lines.push({ y: r.base, a: r.x - r.w / 2, b: r.x + r.w / 2 })
  }
  const path: number[] = []
  for (const l of lines) path.push(l.a, l.y, l.b, l.y)
  // Each glyph's place along that path, as a share of it.
  const acc = [0]
  for (let i = 2; i < path.length; i += 2) acc.push(acc[acc.length - 1] + Math.hypot(path[i] - path[i - 2], path[i + 1] - path[i - 1]))
  const total = acc[acc.length - 1] || 1
  const slots: Slot[] = raw.map((r) => {
    const li = lines.findIndex((l) => Math.abs(r.base - l.y) < r.w * 1.6 + 4 && r.x >= l.a - 1 && r.x <= l.b + 1)
    const l = lines[Math.max(0, li)], s = acc[Math.max(0, li) * 2] + (r.x - l.a)
    return { g: r.g, x: r.x, y: l.y, u: s / total, font: r.font, color: r.color, sx: r.sx }
  })
  return { path, slots }
}
/** Cuts the command's letters onto the sheet, in the faces and inks the page sets them in. */
const cutSlots = (sheet: GlyphSheet, slots: Slot[]): Cut[] => slots.map((S) => ({ ...S, sp: sheet.glyph(S.font, S.color, S.g) }))
let mctx: CanvasRenderingContext2D | null = null
const measureCtx = () => (mctx ??= document.createElement("canvas").getContext("2d")!)

/** Where `u` (0 to 1 along the string) falls among its points, and the string's angle there. */
function at(L: Laid, u: number) {
  const f = Math.min(L.n - 1.001, Math.max(0, u * (L.n - 1))), i = Math.floor(f), t = f - i
  const x = L.x[i] + (L.x[i + 1] - L.x[i]) * t, y = L.y[i] + (L.y[i + 1] - L.y[i]) * t
  const j = Math.max(0, Math.min(L.n - 2, i))
  return { x, y, a: Math.atan2(L.y[j + 1] - L.y[j], L.x[j + 1] - L.x[j]), q: L.q[i] + (L.q[Math.min(L.n - 1, i + 1)] - L.q[i]) * t }
}

// One shared spatial grid for the crossings, and the letters placed this frame, reused every frame.
const CELL = 9
let grid = new Int32Array(0), next = new Int32Array(0)
const placed: { x: number; y: number; a: number; z: number; i: number; k: number; o: number }[] = []

// The last layout of each drawing, for the line's words to update when the package manager changes.
const lastLaid = new WeakMap<HTMLCanvasElement, Laid>()

/** The scene: lays the tangle and reads the line once per layout; each frame bends the string by the scroll and draws it. */
const SCENE = {
    layout(f: Frame): Laid | null {
      const cv = f.ctx.canvas, host = cv.closest<HTMLElement>(".install-run")
      const sec = host?.querySelector<HTMLElement>("section.install")
      const room = sec?.querySelector<HTMLElement>(".install-room")
      if (!host || !cv || !sec || !room) return null
      // The section holds still while the string is pulled; a section taller than the window holds with its foot in view.
      const cs = getComputedStyle(sec), secR = sec.getBoundingClientRect()
      host.style.setProperty("--install-fit", `${Math.round(f.vh - (secR.height - parseFloat(cs.paddingBottom)) - 16)}px`)
      const line = readLine(sec, cv)
      if (!line) return null
      const box = cv.getBoundingClientRect(), rr = room.getBoundingClientRect()
      const rx0 = rr.left - box.left, ry0 = rr.top - box.top, rw = rr.width, rh = rr.height
      const phone = f.phone
      const fs = phone ? 9 : 10.5
      // The tangle: a ball of loose wraps over the right of the line, its loose end lying just over where the line begins.
      const cx = rx0 + rw * (phone ? 0.52 : 0.6), cy = ry0 + rh * 0.5
      const rX = Math.min(rw * (phone ? 0.37 : 0.3), rh * (phone ? 1.05 : 1.25)), rY = rh * 0.44
      const ball = tangle(cx, cy, rX, rY, phone ? 4.2 : 5.5, 4)
      const head = [line.path[0], ry0 + rh - fs * 0.6, 1]
      const lead = phone ? 40 : 80
      const pts: number[] = [head[0], head[1], head[2]]
      const a = [head[0] + lead, head[1], 1]
      cubic(pts, head, [head[0] + lead / 3, head[1], 1], [head[0] + (2 * lead) / 3, head[1], 1], a, 12)
      const b0 = [ball[0], ball[1], ball[2]], b1 = [ball[3], ball[4], ball[5]]
      const tx = b1[0] - b0[0], ty = b1[1] - b0[1], tl = Math.hypot(tx, ty) || 1
      cubic(pts, a, [a[0] + 90, a[1], 1], [b0[0] - (tx / tl) * 90, b0[1] - (ty / tl) * 90, b0[2]], b0, 40)
      for (let i = 3; i < ball.length; i++) pts.push(ball[i])
      // The far end trails out of the ball, down and to the right.
      const m = ball.length, e0 = [ball[m - 3], ball[m - 2], ball[m - 1]], e1 = [ball[m - 6], ball[m - 5], ball[m - 4]]
      const ex = e0[0] - e1[0], ey = e0[1] - e1[1], el = Math.hypot(ex, ey) || 1
      const tail = [Math.min(box.width - 24, e0[0] + rX * 0.5), cy + rY * 1.05, 0.6]
      cubic(pts, e0, [e0[0] + (ex / el) * 70, e0[1] + (ey / el) * 70, e0[2]], [tail[0] - 30, tail[1] - 50, 0.6], tail, 24)
      // Both shapes, at the same number of points evenly spaced along each.
      const probe = resample(pts, 3, 2)
      const n = Math.max(200, Math.round(probe.L / 5))
      const K = resample(pts, 3, n), F = resample(line.path, 2, n)
      const fonts: [string, string, string] = [`300 ${fs * 0.92}px ${f.ink.voice}`, `400 ${fs}px ${f.ink.voice}`, `500 ${fs * 1.08}px ${f.ink.voice}`]
      let text = BURDEN
      const unit = advances(fonts[1], BURDEN).reduce((s, g) => s + g.w, 0)
      while (unit * (text.length / BURDEN.length) < K.L + 40) text += BURDEN
      text = text.trimEnd()
      const glyphs = advances(fonts[1], text)
      const sheet = glyphSheet(f.dpr), inks = [f.ink.pencil, f.ink.graphite, f.ink.ink]
      const cut = glyphs.flatMap(({ g }) => fonts.map((font, k) => sheet.glyph(font, inks[k], g, "middle")))
      const slots = cutSlots(sheet, line.slots)
      sheet.bake()
      const laid: Laid = {
        n, kx: K.out[0], ky: K.out[1], kz: K.out[2], fx: F.out[0], fy: F.out[1],
        x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), q: new Float32Array(n), len: new Float32Array(n),
        glyphs, textLen: glyphs.reduce((s, g) => s + g.w, 0), fs, fonts, slots, sheet, cut,
        // The pull begins just before the section comes to hold, so the knot is seen whole first, and is done a little
        // before the hold ends.
        from: (parseFloat(cs.top) || 64) + f.vh * 0.12,
        to: -(parseFloat(getComputedStyle(host, "::after").height) || 0) * 0.82,
        cy, sec, land: -1,
      }
      if (laid.to > laid.from - 200) laid.to = laid.from - 200
      lastLaid.set(cv, laid)
      return laid
    },
    draw(f: Frame, L: Laid | null) {
      if (!L) return false
      const t = f.still ? 1 : Math.min(1, Math.max(0, (L.from - f.top) / (L.from - L.to)))
      const land = f.still ? 1 : span(t, 0.9, 1)
      if (Math.abs(land - L.land) > 0.001) {
        L.land = land
        L.sec.style.setProperty("--install-land", land.toFixed(3))
      }
      if (t >= 1) return false
      const { ctx } = f, n = L.n
      // The pointer's tug: strands near it are pushed aside, and spring back on their own clock.
      const tug = f.px !== null && f.py !== null && f.since < 1500 ? Math.exp(-f.since / 420) * Math.cos(f.since / 190) * 22 : 0
      const sig2 = 2 * 46 * 46
      let lift = 0
      // As the string tightens, the whole tangle is drawn flatter, its wraps closing up, while each point in turn leaves
      // it for the line.
      const flat = 1 - DRAW * breath(t)
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1)
        const q = breath(Math.min(1, Math.max(0, (t * (1 + W) - u) / W)))
        const ky = L.cy + (L.ky[i] - L.cy) * flat
        let x = L.kx[i] + (L.fx[i] - L.kx[i]) * q, y = ky + (L.fy[i] - ky) * q
        if (tug) {
          const dx = x - f.px!, dy = y - f.py!, d2 = dx * dx + dy * dy
          if (d2 < sig2 * 6) {
            const d = Math.sqrt(d2) || 1, k = tug * Math.exp(-d2 / sig2) * (1 - q)
            x += (dx / d) * k; y += (dy / d) * k
          }
        }
        L.x[i] = x; L.y[i] = y; L.q[i] = q
        L.z[i] = L.kz[i] * flat + (1 - L.kz[i] * flat) * q
        L.len[i] = i ? L.len[i - 1] + Math.hypot(x - L.x[i - 1], y - L.y[i - 1]) : 0
        if (q >= LIFT) lift = i
      }
      const total = L.len[n - 1], sLift = L.len[lift]
      // The run-on is laid from the string's far end back, so the letters in the tangle stay where they are; they give
      // way where the string reaches the line.
      // The placed letters live in one pool reused every frame, so a scroll makes no garbage.
      let np = 0
      let s = total - L.textLen, seg = 0
      for (let gi = 0; gi < L.glyphs.length; gi++) {
        const { g, w } = L.glyphs[gi]
        const mid = s + w / 2
        s += w
        if (mid < sLift + L.fs * 0.5 || g === " ") continue
        while (seg < n - 2 && L.len[seg + 1] < mid) seg++
        if (mid > total) break
        const d = L.len[seg + 1] - L.len[seg], r = d ? (mid - L.len[seg]) / d : 0
        const P = (placed[np++] ??= { x: 0, y: 0, a: 0, z: 0, i: 0, k: 0, o: 0 })
        P.x = L.x[seg] + (L.x[seg + 1] - L.x[seg]) * r; P.y = L.y[seg] + (L.y[seg + 1] - L.y[seg]) * r
        P.a = Math.atan2(L.y[seg + 1] - L.y[seg], L.x[seg + 1] - L.x[seg]); P.z = L.z[seg] + (L.z[seg + 1] - L.z[seg]) * r
        // The run-on's first letters, just off the line, come in rather than appear.
        P.i = gi; P.k = 0; P.o = span(mid - sLift, L.fs * 0.5, L.fs * 8)
      }
      // Crossings: a letter with a nearer strand right over it is left out, so the far strand breaks under the near.
      const cols = Math.ceil(f.w / CELL) + 1, rows = Math.ceil(f.h / CELL) + 1
      if (grid.length < cols * rows) grid = new Int32Array(cols * rows)
      grid.fill(-1, 0, cols * rows)
      if (next.length < np) next = new Int32Array(np * 2)
      for (let p = 0; p < np; p++) {
        const c = Math.min(cols - 1, Math.max(0, Math.floor(placed[p].x / CELL))) + cols * Math.min(rows - 1, Math.max(0, Math.floor(placed[p].y / CELL)))
        next[p] = grid[c]; grid[c] = p
      }
      const reach2 = (L.fs * 0.95) ** 2
      for (let p = 0; p < np; p++) {
        const P = placed[p], gx = Math.floor(P.x / CELL), gy = Math.floor(P.y / CELL)
        let over = false
        for (let oy = -1; oy <= 1 && !over; oy++) {
          const yy = gy + oy
          if (yy < 0 || yy >= rows) continue
          for (let ox = -1; ox <= 1 && !over; ox++) {
            const xx = gx + ox
            if (xx < 0 || xx >= cols) continue
            for (let o = grid[xx + cols * yy]; o >= 0; o = next[o]) {
              const O = placed[o]
              if (O.z > P.z + 0.22 && Math.abs(O.i - P.i) > 4 && (O.x - P.x) ** 2 + (O.y - P.y) ** 2 < reach2) { over = true; break }
            }
          }
        }
        P.k = over ? -1 : P.z > 0.3 ? 2 : P.z > -0.35 ? 1 : 0
      }
      // The letters, by depth: far in pencil and light, middle in graphite, near in ink and a touch heavier.
      const d = f.dpr, { sheet, cut } = L
      for (let k = 0; k < 3; k++) {
        for (let p = 0; p < np; p++) {
          const P = placed[p]
          if (P.k !== k) continue
          const c = Math.cos(P.a), sn = Math.sin(P.a)
          ctx.globalAlpha = P.o
          ctx.setTransform(d * c, d * sn, -d * sn, d * c, d * P.x, d * P.y)
          sheet.draw(ctx, cut[P.i * 3 + k])
        }
      }
      // The command's own letters, where the string has reached the line, each in its own face and ink, turning in
      // with the string and landing on its place; at the very end they hand over to the real line.
      for (const S of L.slots) {
        const p = at(L, S.u)
        const alpha = span(p.q, LIFT, 1) * (1 - land)
        if (alpha <= 0.01) continue
        ctx.globalAlpha = alpha
        const c = Math.cos(p.a), sn = Math.sin(p.a)
        ctx.setTransform(d * c * S.sx, d * sn * S.sx, -d * sn, d * c, d * p.x, d * p.y)
        sheet.draw(ctx, S.sp)
      }
      ctx.globalAlpha = 1
      ctx.setTransform(d, 0, 0, d, 0, 0)
      return tug !== 0
    },
}

export function Install() {
  const run = React.useRef<HTMLDivElement>(null)
  const canvas = useStage<Laid | null>(run, SCENE)

  // Choosing another package manager changes the line's words; the letters the string hands over to follow them.
  React.useEffect(() => {
    const code = run.current?.querySelector(".ot-command-line-text"), cv = canvas.current
    if (!code || !cv) return
    const mo = new MutationObserver(() => {
      const L = lastLaid.get(cv)
      if (!L) return
      const line = readLine(L.sec, cv)
      if (!line) return
      // The letters' places are shares of the new line, so the string lands on the new line too.
      const F = resample(line.path, 2, L.n)
      L.fx = F.out[0]; L.fy = F.out[1]
      L.slots = cutSlots(L.sheet, line.slots)
    })
    mo.observe(code, { childList: true, subtree: true, characterData: true })
    return () => mo.disconnect()
  }, [canvas])

  return (
    <div className="install-run" ref={run}>
      <Sec
        id="install"
        num="04"
        name="Install"
        title="One line."
        className="install"
        note="0nlyType is a shadcn registry. Each piece arrives as source in your project, with its styles and the tokens it stands on."
        wide={<canvas ref={canvas} className="install-knot" aria-hidden="true" />}
      >
        <div className="install-room" aria-hidden="true" />
        <CommandLine runner command={`shadcn@latest add ${registryURL("button")}`} emphasis="button" className="install-line" />
        <p className="install-then">Nothing to update. Nothing to wrap. It&rsquo;s yours now.</p>
        <p className="install-links">
          <Link asChild>
            <NextLink href="/docs/install/">Set up a project</NextLink>
          </Link>
        </p>
      </Sec>
    </div>
  )
}
