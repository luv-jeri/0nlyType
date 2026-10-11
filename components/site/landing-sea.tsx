"use client"

import * as React from "react"

import { TuneSentence } from "@/components/site/landing"
import { Sec } from "@/components/site/landing-section"
import { useStage, type Frame } from "@/components/site/stage"
import { KEYS, PAIRS, SCHEMES } from "@/components/site/theme-controls"
import { measure } from "@/components/site/type-shapes"

// 03, one sentence that retunes the page, floating on a sea of type. The sea is rows of the library's own words (its
// schemes, faces, keys and pieces) seen in perspective: the far rows at the top are tiny, light, pencil and packed
// close, the near rows at the bottom large, heavier and in ink, wider apart, so depth comes from the type alone. Every
// row is a line of water. Its letters ride a swell of three travelling waves crossing at angles, the way open water
// moves: the crests are sharp and the troughs flat, the letters crowd toward each crest and thin out in each trough,
// each turns to the slope under it, and a word on a crest is inked a step darker and cut heavier while one in a trough
// fades a step, so the crests read as bands of tone running through the rows, as in an engraving of the sea.
//
// The swell moves only when the page scrolls. The pointer, or a finger dragged sideways, drops rings that run out
// through the rows in perspective, as ellipses, and are gone within a second and a half. The sentence sits in clear
// water: the rows part round its lines, measured once per layout, the way text flows round a shape, one pretext cursor
// running through both halves of a row.
//
// The point of the section is the retune. Change a word in the sentence and the whole sea is set again in the new face
// and inks; the new setting rolls out from the sentence as one ring of swell with a lane of open water at its front, the
// old sea standing beyond it until the ring has passed, and it reaches the far edge within a second. The words you chose
// (the scheme, the faces, the key, day or night) are yours, so wherever they float they are set in the italic. Under
// reduced motion the sea lies calm and still and a new setting simply replaces the old. The sea draws no accent: the
// key's word in the sentence is the one in view.

type Rect = { l: number; t: number; r: number; b: number }
// A row of the sea: where it rests, its size, how near it is (q, 1 the nearest; Z its distance), how far its letters
// rise and fall, its three inks from trough to crest, its faces, whether it passes the sentence, and its units.
type Row = { y: number; fs: number; q: number; Z: number; amp: number; tone: number; font: string; crest: string; ital: string; guard: boolean; u0: number; u1: number }
// One sea, set once per layout. Every unit (a word far off, a few letters or one letter up close) is held in typed
// arrays: where it rests across the row, its place on the water (X, world units, the nearest row spanning -1..1), the
// waves' phase there and the word it belongs to; each word has its extent across the row and whether it is yours.
// `from` is the sea it replaced, kept while the retune rolls out over it.
type Sea = {
  W: number; H: number; S: number; hY: number; yN: number
  rows: Row[]; inks: string[]; str: string[]; row: Uint16Array; x: Float32Array; X: Float32Array; ph: Float32Array; word: Uint32Array
  wl: Float32Array; wr: Float32Array; mine: Uint8Array
  clear: Rect[]; ox: number; oy: number; reach: number; key: string; from: Sea | null; t0: number
}
type Drop = { X: number; Z: number; t: number; s: number }
type Water = { drops: Drop[]; at: number; px: number; py: number; dx: number; dy: number }

const TAU = Math.PI * 2
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
// The swell, in world units: wavelength, height, and the heading it travels on, in degrees from straight toward you.
// A long, slow swell, then shorter, steeper chop crossing it. Each wave's speed follows deep water (with the root of
// its wavenumber), so the chop slides over the swell rather than riding with it.
const WAVES = [
  { l: 1.9, a: 0.5, deg: 30 },
  { l: 0.83, a: 0.3, deg: -42 },
  { l: 0.37, a: 0.16, deg: 66 },
].map((w) => {
  const k = TAU / w.l, r = (w.deg * Math.PI) / 180
  return { a: w.a, k, dx: Math.sin(r), dz: -Math.cos(r), om: 1.6 * Math.sqrt(k) }
})
const SUM_A = WAVES.reduce((s, w) => s + w.a, 0)
// Crests sharpen and troughs flatten (the surface plus a share of its square); and the water itself is carried round
// in each wave, toward each crest (Gerstner's waves), by this much, in world units per unit of height.
const CHOP = 0.42, CARRY = 0.025
// A word stands on a crest above this height, and lies in a trough below this one.
const CREST = 0.3, TROUGH = -0.3
// A ring from the pointer: its speed (world units a second), wavelength, the width of its packet, its life.
const RING = { c: 0.85, k: TAU / 0.2, w: 0.13, life: 1400 }
// The retune's ring: how long it takes to cross the whole sea, how high its crest stands, how wide it is (px), and how
// much flatter than a circle it runs, as the water is seen.
const ROLL = { T: 950, lift: 0.95, w: 70, flat: 1.8 }

const seed = (n: number) => () => {
  n = (n + 0x6d2b79f5) | 0
  let t = Math.imul(n ^ (n >>> 15), 1 | n)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** The library's words: the four switches' vocabulary, and the pieces, read from the page's own index of them. */
function vocabulary() {
  const faces = PAIRS.flatMap((p) => p.words.split(" and "))
  const switches = [...SCHEMES, ...PAIRS.map((p) => p.value), ...faces, ...KEYS, "day", "night"]
  const pieces = new Set<string>()
  for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-i][href*='/docs/']")) {
    const m = /\/docs\/([^/]+)\/?$/.exec(a.getAttribute("href") ?? "")
    if (m) pieces.add(m[1])
  }
  return { switches, pieces: pieces.size ? [...pieces] : switches }
}

/** The words you chose, as <html> holds them now. */
function chosen() {
  const d = document.documentElement.dataset
  const pair = PAIRS.find((p) => p.value === (d.pair ?? "parma")) ?? PAIRS[0]
  return new Set([d.scheme ?? "cotton", pair.value, ...pair.words.split(" and "), ...(d.key ? [d.key] : []), d.mode === "nocturne" ? "night" : "day"])
}

/** The sentence's lines, as boxes in the canvas's space, each padded to the clear water around it. */
function clearWater(p: HTMLElement | null, cv: HTMLCanvasElement, w: number, h: number): Rect[] {
  if (!p) return []
  const box = cv.getBoundingClientRect(), range = document.createRange()
  range.selectNodeContents(p)
  const lines: Rect[] = []
  for (const r of range.getClientRects()) {
    if (r.width < 1 || r.height < 1) continue
    const t = r.top - box.top, b = r.bottom - box.top, l = r.left - box.left, rr = r.right - box.left
    const line = lines.find((q) => Math.min(q.b, b) - Math.max(q.t, t) > 0.5 * Math.min(q.b - q.t, b - t))
    if (line) Object.assign(line, { l: Math.min(line.l, l), r: Math.max(line.r, rr), t: Math.min(line.t, t), b: Math.max(line.b, b) })
    else lines.push({ l, t, r: rr, b })
  }
  const em = parseFloat(getComputedStyle(p).fontSize) || 48
  return lines.map((q) => ({ l: Math.max(0, q.l - 0.6 * em), r: Math.min(w, q.r + 0.6 * em), t: Math.max(0, q.t - 0.1 * em), b: Math.min(h, q.b + 0.1 * em) }))
}

// Advances by font and text, kept for the page's life, so a retune back to a face measures nothing again.
const widths = new Map<string, Map<string, number>>()
const width = (font: string, g: string) => {
  let m = widths.get(font)
  if (!m) widths.set(font, (m = new Map()))
  let v = m.get(g)
  if (v === undefined) m.set(g, (v = measure(font, g)))
  return v
}

async function setSea(f: Frame, cv: HTMLCanvasElement | null, sentence: HTMLElement | null, prev: Sea | null): Promise<Sea | null> {
  const { w: W, h: H, lib, ink, phone, still } = f
  if (!cv) return null
  const voice = ink.voice || "sans-serif", expr = ink.expression || "serif"
  await Promise.all([document.fonts.load(`400 16px ${voice}`), document.fonts.load(`italic 400 16px ${expr}`)]).catch(() => {})
  const mine = chosen(), { switches, pieces } = vocabulary()
  const inks = [ink.pencil, ink.graphite, ink.ink]
  const key = [voice, expr, ...inks, ink.paper, [...mine].join(" ")].join("|")
  const clear = clearWater(sentence, cv, W, H)

  // Perspective by type alone: a row's size grows in proportion to its distance below the horizon (which stands just
  // above the canvas), so the rows' places follow from their sizes. Far rows sit close, near rows wider apart.
  const fsFar = phone ? 5 : 4.6, fsNear = phone ? 24 : 29
  const yTop = fsFar + 2, yBot = H - fsNear * 0.9
  const kap = (fsNear - fsFar) / (yBot - yTop), hY = yTop - fsFar / kap, A = fsNear * (still ? 0.45 : 0.72)
  // (Under reduced motion the swell is lower: a calm sea.) Pixels to a world unit on the nearest row. A phone looks at a narrower stretch of the same water, so its waves
  // keep their length rather than crowding into the small screen.
  const S = Math.max(W, 1100) / 2
  const rows: Row[] = []
  for (let y = yTop; y <= yBot + 0.5; ) {
    const fs = kap * (y - hY), q = fs / fsNear
    rows.push({ y, fs, q, Z: 1 / q, amp: A * Math.pow(q, 0.7), tone: 0, font: "", crest: "", ital: "", guard: false, u0: 0, u1: 0 })
    y += fs * (phone ? 1.6 + 0.45 * q : 1.5 + 0.45 * q)
  }

  const str: string[] = [], row: number[] = [], xs: number[] = [], Xs: number[] = [], word: number[] = []
  const wl: number[] = [], wr: number[] = [], own: number[] = []
  const words = (r: number, need: number, q: number) => {
    const rnd = seed(r * 7919 + 17), out: string[] = []
    let len = 0
    while (len < need) {
      const list = rnd() < 0.15 + 0.4 * q ? switches : pieces
      const w = list[Math.floor(rnd() * list.length)]
      out.push(w)
      len += w.length + 1
    }
    return out.join(" ")
  }
  rows.forEach((R, r) => {
    const { fs, q } = R
    // Hairline-light pencil far off, graphite between, heavier ink up close; crests a heavier cut of the same face.
    const wt = Math.round(100 + 380 * Math.pow(q, 1.3))
    R.tone = q < 0.38 ? 0 : q < 0.82 ? 1 : 2
    R.font = `${wt} ${fs.toFixed(2)}px ${voice}`
    R.crest = `${Math.min(900, Math.round(wt + 60 + 200 * q))} ${fs.toFixed(2)}px ${voice}`
    R.ital = `italic ${Math.max(400, wt)} ${(fs * 1.12).toFixed(2)}px ${expr}`
    // Where this row crosses the sentence's clear water it parts: two runs, one either side, on one cursor.
    const reach = R.amp * SUM_A * (1 + CHOP) + fs * 0.2
    const top = R.y - fs * 0.8 - reach, bot = R.y + fs * 0.3 + reach
    const cuts = clear.filter((c) => c.b > top && c.t < bot).map((c) => [c.l - fs * 0.5, c.r + fs * 0.5]).sort((a, b) => a[0] - b[0])
    R.guard = cuts.length > 0
    const runs: [number, number][] = []
    let at = -fs * 2
    for (const [a, b] of cuts) {
      if (a > at) runs.push([at, a])
      at = Math.max(at, b)
    }
    runs.push([at, W + fs * 2])
    const prepared = lib.prepareWithSegments(words(r, Math.ceil((W + fs * 4) / (fs * 0.4)), q), R.font)
    let cur = { segmentIndex: 0, graphemeIndex: 0 }
    R.u0 = str.length
    // A word far off is one unit; nearer it is cut into pieces of a few letters, and up close into single letters,
    // so each turns to the curve under it.
    const chunk = fs >= 24 ? 1 : fs >= 17 ? 2 : fs >= 11 ? 3 : 99
    const space = width(R.font, " "), lo = space * (1.3 + 2.4 * (1 - q)), hi = lo * 2.2
    for (const [a, b] of runs) {
      const rw = b - a, seen = Math.min(b, W) - Math.max(a, 0), edge = a < 0 || b > W
      if (seen < (edge ? Math.max(fs * 8, 260) : Math.max(fs * 8, 220))) continue
      const line = lib.layoutNextLine(prepared, cur, rw)
      if (!line) break
      cur = line.end
      const ws = line.text.trim().split(/\s+/).filter(Boolean)
      if (!ws.length) continue
      const fonts = ws.map((w) => (mine.has(w) ? R.ital : R.font))
      const nat = ws.reduce((s, w, i) => s + width(fonts[i], w), 0)
      // Justified by the word space so the rows run edge to edge, like the lines of an engraving; far rows looser.
      const gap = ws.length > 1 ? clamp((rw - nat) / (ws.length - 1), lo, hi) : 0
      let x = a
      ws.forEach((w, i) => {
        const gs = [...w], fnt = fonts[i], k = wl.length
        wl.push(x); own.push(fnt === R.ital ? 1 : 0)
        for (let j = 0; j < gs.length; j += chunk) {
          const s = gs.slice(j, j + chunk).join(""), sw = width(fnt, s), cx = x + sw / 2
          str.push(s); row.push(r); xs.push(cx); Xs.push(((cx - W / 2) / S) * R.Z); word.push(k)
          x += sw
        }
        wr.push(x)
        x += gap
      })
    }
    R.u1 = str.length
  })

  const n = str.length, ph = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const Z = rows[row[i]].Z
    WAVES.forEach((wv, j) => (ph[i * 3 + j] = wv.k * (wv.dx * Xs[i] + wv.dz * Z)))
  }
  // The retune rolls out from the middle of the sentence across the page, as an ellipse flattened the way the water is seen.
  const cxs = clear.length ? clear.reduce((s, c) => s + (c.l + c.r) / 2, 0) / clear.length : W / 2
  const cys = clear.length ? clear.reduce((s, c) => s + (c.t + c.b) / 2, 0) / clear.length : H / 2
  const reach = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - cxs, (y - cys) * ROLL.flat)))
  const sea: Sea = {
    W, H, S, hY, yN: yBot, rows, inks, str, row: Uint16Array.from(row), x: Float32Array.from(xs), X: Float32Array.from(Xs), ph, word: Uint32Array.from(word),
    wl: Float32Array.from(wl), wr: Float32Array.from(wr), mine: Uint8Array.from(own), clear, ox: cxs, oy: cys, reach, key, from: null, t0: 0,
  }
  // A new face or ink (not a resize, not the fonts arriving) is a retune: keep the old sea to roll out over.
  if (prev && prev.key !== key && !still && prev.W === W && prev.H === H) {
    sea.from = { ...prev, from: null }
    sea.t0 = performance.now()
  }
  return sea
}

export function Sea() {
  const host = React.useRef<HTMLDivElement>(null)
  const float = React.useRef<HTMLDivElement>(null)
  const last = React.useRef<Sea | null>(null)
  // The pointer's rings, and the last move seen, kept across frames.
  const water = React.useRef<Water>({ drops: [], at: -1, px: 0, py: 0, dx: -1e9, dy: -1e9 })
  const canvas = useStage<Sea | null>(host, {
    layout: async (f) => {
      const sea = await setSea(f, canvas.current, float.current?.querySelector<HTMLElement>(".tune-sentence") ?? null, last.current)
      last.current = sea
      return sea
    },
    draw: (f, sea) => (sea ? drawSea(f, sea, water.current) : false),
  })
  return (
    <Sec
      id="tune"
      num="03"
      name="Tune"
      title="One sentence retunes the page."
      note="Every italic word is a choice. Change one, and everything follows."
      className="sea-sec"
      wide={
        <div className="sea" ref={host}>
          <canvas className="sea-canvas" ref={canvas} aria-hidden="true" />
          <div className="sea-float" ref={float}>
            <TuneSentence />
          </div>
        </div>
      }
    />
  )
}

/** One frame of the sea. True while a ring or the retune is still running out. */
function drawSea(f: Frame, sea: Sea, water: Water) {
  const { ctx, dpr, now, still } = f
  // Where the scroll has carried the swell: one unit for every screen of scroll, from the moment the sea comes up.
  // Reduced motion holds one calm moment of it.
  const t = still ? 0.35 : (f.vh - f.top) / Math.max(1, f.vh)

  // A new move of the pointer drops a ring wherever it has travelled far enough from the last one, or where it is
  // pressed; a quicker hand drops a stronger one.
  const drops = water.drops
  if (!still && f.px !== null && f.py !== null) {
    const at = now - f.since
    if (at !== water.at) {
      const dist = Math.hypot(f.px - water.dx, f.py - water.dy), dt = Math.max(16, at - water.at)
      const sp = Math.hypot(f.px - water.px, f.py - water.py) / dt
      if (dist > 22 || dist < 0.5) {
        const q = clamp((f.py - sea.hY) / (sea.yN - sea.hY), 0.12, 1.15), Z = 1 / q
        drops.push({ X: ((f.px - sea.W / 2) / sea.S) * Z, Z, t: at, s: dist < 0.5 ? 1 : clamp(0.35 + sp * 0.5, 0.35, 1) })
        if (drops.length > 18) drops.shift()
        water.dx = f.px; water.dy = f.py
      }
      water.at = at; water.px = f.px; water.py = f.py
    }
  }
  while (drops.length && now - drops[0].t > RING.life) drops.shift()

  const rolling = sea.from && !still ? clamp((now - sea.t0) / ROLL.T, 0, 1) : 1
  // The ring's radius, eased out: quick from the sentence, slowing as it nears the far water.
  const R = (1 - Math.pow(1 - rolling, 2)) * (sea.reach + ROLL.w * 3)
  if (sea.from && rolling < 1) layer(ctx, dpr, sea.from, t, drops, now, R, false)
  else sea.from = null
  layer(ctx, dpr, sea, t, drops, now, rolling < 1 ? R : Infinity, true)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return drops.length > 0 || rolling < 1
}

/** Draws one setting of the sea: inside the retune's ring (`inner`) or beyond it, which is all of it once it is done. */
function layer(ctx: CanvasRenderingContext2D, dpr: number, sea: Sea, t: number, drops: Drop[], now: number, R: number, inner: boolean) {
  const { rows, inks, str, x, X, ph, word, wl, wr, mine, clear, hY, yN } = sea
  const om = WAVES.map((w) => w.om * t), live = drops.map((d) => ({ ...d, age: (now - d.t) / 1000 }))
  const rolling = R !== Infinity, depth = yN - hY
  ctx.textAlign = "center"
  ctx.textBaseline = "alphabetic"
  let font = "", fill = ""
  for (const row of rows) {
    const { y, Z, q, amp, fs, tone } = row, toX = sea.S / Z, toY = depth * q * q, dXdx = Z / sea.S
    let wk = -1, skip = false, gone = false, look = row.font, ink = inks[tone]
    for (let i = row.u0; i < row.u1; i++) {
      const Xi = X[i], k = word[i], first = k !== wk
      // The roll: this setting keeps whole words on its side of the ring, with a lane of open water between the two,
      // and the new words just behind the ring stand up on its crest.
      if (first) {
        wk = k
        gone = rolling && (inner ? 1 : -1) * (Math.hypot((wl[k] + wr[k]) / 2 - sea.ox, (y - sea.oy) * ROLL.flat) - R) > -ROLL.w * 0.35
      }
      if (gone) continue
      let lift = 0
      if (rolling && inner) {
        const e = (Math.hypot(x[i] - sea.ox, (y - sea.oy) * ROLL.flat) - R) / ROLL.w
        if (e > -3) lift = ROLL.lift * Math.exp(-e * e)
      }
      // The swell: three waves, the crest sharpened, and the water carried toward each crest.
      let s = 0, ds = 0, cx = 0, cz = 0
      for (let j = 0; j < 3; j++) {
        const wv = WAVES[j], th = ph[i * 3 + j] - om[j], sn = Math.sin(th), cs = Math.cos(th)
        s += wv.a * sn
        ds += wv.a * wv.k * wv.dx * cs
        cx += wv.a * wv.dx * cs
        cz += wv.a * wv.dz * cs
      }
      let eta = s + CHOP * s * Math.abs(s), deta = ds * (1 + 2 * CHOP * Math.abs(s))
      // The rings: each a short packet of waves running out from where it fell, lower as it spreads and ages.
      for (const d of live) {
        const dx = Xi - d.X, dz = Z - d.Z, dist = Math.sqrt(dx * dx + dz * dz), rho = RING.c * d.age
        const u = (dist - rho) / RING.w
        if (u < -3 || u > 3) continue
        const life = 1 - d.age / (RING.life / 1000), env = (Math.exp(-u * u) * d.s * life * life) / Math.sqrt(1 + 5 * rho)
        const p2 = RING.k * (dist - rho)
        eta += 1.5 * env * Math.cos(p2)
        deta -= 0.4 * env * RING.k * Math.sin(p2) * (dist > 1e-4 ? dx / dist : 0)
      }
      eta += lift
      const xx = x[i] + CARRY * cx * toX, yy = y - eta * amp + CARRY * cz * toY
      // A word's look is settled at its first unit: on a crest it is inked darker and cut heavier (far rows only darker,
      // too fine for a weight to show, and a face switch costs time), in a trough it fades; yours is in the italic.
      // Near the sentence, a word the water lifts into its clear water is left out.
      if (first) {
        if (mine[wk]) { look = row.ital; ink = inks[Math.min(2, tone + 1)] }
        else {
          const up = eta > CREST || lift > 0.45
          look = up && fs >= 9 ? row.crest : row.font
          ink = inks[clamp(tone + (up ? 1 : eta < TROUGH ? -1 : 0), 0, 2)]
        }
        skip = false
        if (row.guard) {
          const dx = xx - x[i], l = wl[wk] + dx, r = wr[wk] + dx
          for (const c of clear) if (r > c.l && l < c.r && yy + fs * 0.25 > c.t && yy - fs * 0.8 < c.b) { skip = true; break }
        }
      }
      if (skip) continue
      if (look !== font) ctx.font = font = look
      if (ink !== fill) ctx.fillStyle = fill = ink
      const slope = clamp(-deta * dXdx * amp, -0.9, 0.9), c = 1 / Math.sqrt(1 + slope * slope), sn = slope * c
      ctx.setTransform(dpr * c, dpr * sn, -dpr * sn, dpr * c, dpr * xx, dpr * yy)
      ctx.fillText(str[i], 0, 0)
    }
  }
}
