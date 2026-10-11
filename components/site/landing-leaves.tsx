"use client"

import * as React from "react"

import { Sec } from "@/components/site/landing-section"
import { useStage, type Frame, type Inks } from "@/components/site/stage"
import { fillShape, justify, measure, type ShapeLine } from "@/components/site/type-shapes"

// 02, what the library leaves out (INTENT.md, "What it refuses"). Each refused thing hangs over the list drawn as
// itself and made only of its own word, in fine small type, the way an engraving makes tone from its lines: a framed
// landscape set in "picture", a box in "box", a card set in "card" with its hard offset shadow set lighter and sparser
// in "shadow", a gradient set in "gradient" by line spacing and weight alone, and a gear, the icon of every settings
// page, set in "icon". They hang at slight angles, as the posters' collage does.
//
// Then the stage holds still and the scroll takes them apart. A picture's lines let go from the bottom up; each letter
// drops on its own arc, turning a little, and comes down inside the strokes of its word in the list below, so for a
// moment the word is written in the picture's dust. The real word inks in under the dust as it settles, and a hairline
// strikes it out. What is left is the list, struck, and what was kept: words, space and one accent.
//
// Every frame is a pure function of how far the scroll has carried the stage, so it plays backwards when you scroll
// back up; nothing moves by itself. The list is real text, struck by a scroll timeline over the same stretch
// (app/landing-leaves.css), and the canvas only ever draws letters. Under reduced motion the pictures hang whole and
// small above the struck list. Each picture is drawn once into its own sheet at layout; a frame copies whole pictures,
// or the lines still hanging, from it, and draws only the letters in flight one at a time, from a sheet of glyphs.

const LEFT_OUT = ["Pictures", "boxes", "cards", "shadows", "gradients", "icons drawn as pictures"]
// Where each word's picture starts to let go, as a share of the stage's held stretch, in the list's order. The CSS
// reads the same numbers (--a), so the real word inks and is struck just as its letters land.
const AT = [0.04, 0.16, 0.28, 0.36, 0.48, 0.6]
/** The stretch over which a picture's lines let go, bottom first; one letter's fall and settle; the share of it spent falling. */
const LET_GO = 0.14, FALL = 0.12, FLIGHT = 0.7, FADE = 0.03, FLY = 0.5

type Lib = Frame["lib"]
type Pen = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
type Tone = "ink" | "graphite" | "pencil"
type Row = { y: number; lh: number; weight: number; tone: Tone }
/** One part of a picture: the shape it fills (or the rows it is set in), its word and how it is inked. lh is in sizes. */
type Part = { word: number; text: string; weight: number; tone: Tone; lh: number; draw?: (x: Pen) => void; rows?: (h: number, fs: number) => Row[] }
type Pic = { w: number; h: number; parts: Part[] }

const poly = (x: Pen, p: number[]) => {
  x.beginPath()
  x.moveTo(p[0], p[1])
  for (let i = 2; i < p.length; i += 2) x.lineTo(p[i], p[i + 1])
  x.closePath()
  x.fill()
}
const cut = (x: Pen, f: () => void) => {
  x.globalCompositeOperation = "destination-out"
  f()
  x.globalCompositeOperation = "source-over"
}

// The five pictures, each in its own units; the scene scales them to the room it has.
const PICS: Pic[] = [
  // A framed landscape: the frame, two ranges of hills, and a sun.
  {
    w: 300, h: 228, parts: [
      { word: 0, text: "picture", weight: 640, tone: "ink", lh: 1.06, draw: (x) => { x.fillRect(0, 0, 300, 228); cut(x, () => x.fillRect(24, 24, 252, 180)) } },
      { word: 0, text: "picture", weight: 430, tone: "graphite", lh: 1.06, draw: (x) => poly(x, [30, 200, 30, 156, 72, 112, 104, 138, 164, 72, 214, 130, 238, 116, 270, 150, 270, 200]) },
      { word: 0, text: "picture", weight: 780, tone: "ink", lh: 1.06, draw: (x) => { x.beginPath(); x.arc(226, 66, 25, 0, 7); x.fill() } },
    ],
  },
  // A box: three faces of a cube, lit from above, toned by weight and spacing.
  {
    w: 190, h: 202, parts: [
      { word: 1, text: "box", weight: 300, tone: "pencil", lh: 1.55, draw: (x) => poly(x, [95, 6, 182, 50, 95, 94, 8, 50]) },
      { word: 1, text: "box", weight: 470, tone: "graphite", lh: 1.06, draw: (x) => poly(x, [8, 56, 92, 99, 92, 198, 8, 154]) },
      { word: 1, text: "box", weight: 760, tone: "ink", lh: 1.06, draw: (x) => poly(x, [98, 99, 182, 56, 182, 154, 98, 198]) },
    ],
  },
  // A card and its hard drop shadow, the shadow lighter and sparser.
  {
    w: 268, h: 190, parts: [
      { word: 2, text: "card", weight: 470, tone: "ink", lh: 1.06, draw: (x) => { x.beginPath(); x.roundRect(0, 0, 236, 158, 16); x.fill() } },
      {
        word: 3, text: "shadow", weight: 320, tone: "pencil", lh: 1.6, draw: (x) => {
          x.beginPath(); x.roundRect(30, 30, 236, 158, 16); x.fill()
          cut(x, () => { x.beginPath(); x.roundRect(-5, -5, 246, 168, 20); x.fill() })
        },
      },
    ],
  },
  // A gradient by type alone: heavy, close lines at the top, thinning out and falling in weight to hairlines.
  {
    w: 200, h: 236, parts: [
      {
        word: 4, text: "gradient", weight: 0, tone: "ink", lh: 1, rows: (h, fs) => {
          const out: Row[] = []
          for (let y = 0; ; ) {
            const t = y / h, lh = fs * (1 + 1.9 * t * t)
            if (y + lh > h) break
            out.push({ y, lh, weight: Math.round((860 - 760 * Math.pow(t, 0.8)) / 20) * 20, tone: t < 0.34 ? "ink" : t < 0.68 ? "graphite" : "pencil" })
            y += lh
          }
          return out
        },
      },
    ],
  },
  // An icon: a gear, its teeth, its hole.
  {
    w: 150, h: 150, parts: [
      {
        word: 5, text: "icon", weight: 620, tone: "ink", lh: 1.06, draw: (x) => {
          x.beginPath(); x.arc(75, 75, 53, 0, 7); x.fill()
          for (let k = 0; k < 8; k++) {
            x.save(); x.translate(75, 75); x.rotate((k * Math.PI) / 4 + Math.PI / 8); x.fillRect(-12, -75, 24, 30); x.restore()
          }
          cut(x, () => { x.beginPath(); x.arc(75, 75, 21, 0, 7); x.fill() })
        },
      },
    ],
  },
]

// Where the pictures hang: centre x and y as shares of the room, a scale, and a tilt in degrees. The room is the page's
// width over the list while the stage is held. Under reduced motion the pictures sit in rows above the list instead
// (one row wide, three on a phone), packed side by side so none is cut by the edge; there only the scale and tilt count,
// and y nudges a picture up or down in its row.
type Hang = [number, number, number, number][]
const HANG: Record<"wide" | "phone" | "wideStill" | "phoneStill", Hang> = {
  wide: [[0.155, 0.5, 1.1, -3], [0.4, 0.3, 0.92, 4], [0.615, 0.6, 1, -2.5], [0.835, 0.36, 0.92, 3], [0.962, 0.72, 0.84, -7]],
  phone: [[0.34, 0.2, 0.6, -3], [0.2, 0.66, 0.6, 4], [0.62, 0.52, 0.56, -2.5], [0.87, 0.86, 0.5, 3], [0.86, 0.15, 0.56, -7]],
  wideStill: [[0, 0.5, 1, -3], [0, 0.44, 0.9, 4], [0, 0.54, 1, -2.5], [0, 0.46, 0.9, 3], [0, 0.56, 0.8, -7]],
  phoneStill: [[0, 0.5, 1, -3], [0, 0.5, 0.95, 4], [0, 0.5, 1, -2.5], [0, 0.5, 0.95, 3], [0, 0.5, 0.8, -7]],
}
const ROWS = { wide: [[0, 1, 2, 3, 4]], phone: [[0], [1, 4], [2, 3]] }

// The reduced-motion rows: the one scale that fits every row across the room and all rows down it, and each
// picture's centre, the rows centred both ways.
function pack(hang: Hang, rows: number[][], rw: number, rh: number, gap: number) {
  const across = (r: number[]) => r.reduce((a, n) => a + PICS[n].w * hang[n][2], 0)
  const tall = (r: number[]) => Math.max(...r.map((n) => PICS[n].h * hang[n][2]))
  const k = Math.min(
    ...rows.map((r) => (rw * 0.94 - gap * (r.length - 1)) / across(r)),
    (rh * 0.9 - gap * (rows.length - 1)) / rows.reduce((a, r) => a + tall(r), 0),
  )
  const at: [number, number][] = []
  let y = (rh - rows.reduce((a, r) => a + tall(r) * k, 0) - gap * (rows.length - 1)) / 2
  for (const r of rows) {
    const rowH = tall(r) * k
    let x = (rw - across(r) * k - gap * (r.length - 1)) / 2
    for (const n of r) {
      const w = PICS[n].w * hang[n][2] * k, h = PICS[n].h * hang[n][2] * k
      at[n] = [x + w / 2, y + rowH / 2 + (hang[n][1] - 0.5) * (rowH - h + 0.1 * h)]
      x += w + gap
    }
    y += rowH + gap
  }
  return { k, at }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const sheet = (w: number, h: number) => {
  const c = typeof OffscreenCanvas === "undefined" ? Object.assign(document.createElement("canvas"), { width: w, height: h }) : new OffscreenCanvas(w, h)
  return { c, x: c.getContext("2d") as Pen }
}

// The ink of a word in the list, as points on the canvas: each letter drawn where the page set it, then every inked
// pixel kept, so the falling letters can come down inside the word's own strokes.
function inkOf(el: Element, origin: DOMRect) {
  const node = el.firstChild
  if (!node || node.nodeType !== Node.TEXT_NODE) return new Float32Array(0)
  const css = getComputedStyle(el), font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`
  const text = node.textContent ?? "", range = document.createRange()
  const at: { ch: string; x: number; top: number }[] = []
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let i = 0; i < text.length; i++) {
    if (/\s/.test(text[i])) continue
    range.setStart(node, i); range.setEnd(node, i + 1)
    const b = range.getBoundingClientRect()
    at.push({ ch: text[i], x: b.left, top: b.top })
    x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top); x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom)
  }
  if (!at.length) return new Float32Array(0)
  const W = Math.ceil(x1 - x0) + 4, H = Math.ceil(y1 - y0) + 4, { c, x } = sheet(W, H)
  x.font = font
  const asc = x.measureText("H").fontBoundingBoxAscent
  for (const a of at) x.fillText(a.ch, a.x - x0 + 2, a.top - y0 + 2 + asc)
  const img = x.getImageData(0, 0, c.width, c.height).data, pts: number[] = []
  for (let y = 0; y < H; y += 2) for (let i = 0; i < W; i += 2) if (img[(y * W + i) * 4 + 3] > 140) pts.push(x0 - origin.left - 2 + i, y0 - origin.top - 2 + y)
  return Float32Array.from(pts)
}

type Line = { x: number; y: number; w: number; h: number; rel0: number; rel1: number; g0: number; g1: number }
type Laid = {
  still: boolean
  pics: { x: number; y: number; c: number; s: number; w: number; h: number; sheet: CanvasImageSource; rel0: number; l0: number; l1: number }[]
  lines: Line[]
  /** Per letter: home on the canvas and its tilt there, where it lands, when it lets go, its hop, drift and spin, its glyph. */
  hx: Float32Array; hy: Float32Array; ha: Float32Array; tx: Float32Array; ty: Float32Array
  rel: Float32Array; hop: Float32Array; drift: Float32Array; spin: Float32Array; cell: Int32Array; fly: Uint8Array
  atlas: CanvasImageSource; cells: Float32Array
}

function lay(f: Frame, list: HTMLElement | null): Laid | null {
  const { lib, ink, dpr, w: W, h: H, still, phone } = f
  const cv = f.ctx.canvas, box = cv.getBoundingClientRect()
  const stage = cv.parentElement?.getBoundingClientRect() ?? box
  const fs = phone ? 5 : 6.4
  // The room the pictures hang in: under the bar, over the list, across the page's columns.
  let rx = stage.left - box.left, rw = stage.width, ry = 0, rh = H
  if (!still) {
    const top = list ? list.getBoundingClientRect().top - box.top : H * 0.6
    ry = 64 + (phone ? 16 : 28); rh = Math.max(120, top - ry - (phone ? 24 : 40))
  } else {
    rx = 0; rw = W
  }
  const hang = HANG[still ? (phone ? "phoneStill" : "wideStill") : phone ? "phone" : "wide"]
  const packed = still ? pack(hang, phone ? ROWS.phone : ROWS.wide, rw, rh, phone ? 14 : 40) : null
  const k = packed ? packed.k : phone ? Math.min(rw / 335, rh / 400) : Math.min(rh / 320, rw / 1070, 1.5)

  // Where the letters land: the ink of each word in the list.
  const ink0 = !still && list ? [...list.querySelectorAll(".leaves-strike")].map((el) => inkOf(el, box)) : []

  const styles: { font: string; color: string }[] = [], styleOf = new Map<string, number>()
  const style = (weight: number, tone: Tone) => {
    const key = `${weight}|${tone}`
    let i = styleOf.get(key)
    if (i === undefined) {
      i = styles.push({ font: `${weight} ${fs}px ${ink.voice}`, color: ink[tone as keyof Inks] }) - 1
      styleOf.set(key, i)
    }
    return i
  }
  const advance = new Map<string, number>()
  const adv = (font: string, ch: string) => {
    const key = font + "|" + ch
    let a = advance.get(key)
    if (a === undefined) advance.set(key, (a = measure(font, ch)))
    return a
  }

  type G = { lx: number; ly: number; st: number; ch: string; word: number; line: number }
  const lines: Line[] = [], glyphs: G[] = [], pics: Laid["pics"] = []
  const cellOf = new Map<string, number>(), cellKeys: [number, string][] = []
  const prepared = new Map<string, ReturnType<Lib["prepareWithSegments"]>>()
  const prep = (text: string, font: string) => {
    const key = text + "|" + font
    let p = prepared.get(key)
    if (!p) prepared.set(key, (p = lib.prepareWithSegments(Array(90).fill(text).join(" "), font)))
    return p
  }

  PICS.forEach((pic, n) => {
    const [cxs, cys, sc, deg] = hang[n], kk = k * sc, pw = pic.w * kk, ph = pic.h * kk
    const { c: pc, x: px } = sheet(Math.ceil(pw * dpr), Math.ceil(ph * dpr))
    px.scale(dpr, dpr)
    const l0 = lines.length
    for (const part of pic.parts) {
      // The part's lines: the shape's bands, or the gradient's rows, each a line of the word set to its width.
      const set: { l: ShapeLine; lh: number; st: number }[] = []
      if (part.rows) {
        const cur = new Map<string, { segmentIndex: number; graphemeIndex: number }>()
        for (const r of part.rows(ph, fs)) {
          const st = style(r.weight, r.tone), font = styles[st].font, p = prep(part.text, font)
          let line = lib.layoutNextLine(p, cur.get(font) ?? { segmentIndex: 0, graphemeIndex: 0 }, pw)
          if (!line) line = lib.layoutNextLine(p, { segmentIndex: 0, graphemeIndex: 0 }, pw)
          if (!line) continue
          cur.set(font, line.end)
          const t = line.text.trim()
          if (t) set.push({ l: { x: 0, y: r.y, w: pw, text: t, fit: justify(font, t, pw, fs) }, lh: r.lh, st })
        }
      } else if (part.draw) {
        const st = style(part.weight, part.tone), font = styles[st].font, lh = fs * part.lh, draw = part.draw
        const got = fillShape(lib, pw, ph, (x) => { x.scale(kk, kk); draw(x) }, Array(90).fill(part.text).join(" "), font, fs, lh, { min: 1.9, prepared: prep(part.text, font) })
        for (const l of got) set.push({ l, lh, st })
      }
      // Each letter's place along its line, spread as the line is justified: by the word gaps, or by letter space.
      for (const { l, lh, st } of set) {
        const font = styles[st].font, chars = [...l.text], gaps = chars.filter((c) => c === " ").length
        let nat = 0
        for (const c of chars) nat += adv(font, c)
        const extra = Math.max(0, l.fit - nat), ws = gaps ? extra / gaps : 0, ls = gaps ? 0 : extra / Math.max(1, chars.length - 1)
        const base = l.y + lh / 2 + fs * 0.265, li = lines.length, g0 = glyphs.length
        px.font = font; px.fillStyle = styles[st].color
        let x = l.x
        for (const c of chars) {
          const a = adv(font, c)
          if (c !== " ") {
            px.fillText(c, x, base)
            const key = st + "|" + c
            if (!cellOf.has(key)) { cellOf.set(key, cellKeys.length); cellKeys.push([st, c]) }
            glyphs.push({ lx: x + a / 2, ly: base - fs * 0.265, st, ch: c, word: part.word, line: li })
          }
          x += a + ls + (c === " " ? ws : 0)
        }
        lines.push({ x: l.x - 1, y: l.y, w: Math.max(l.w, l.fit) + 2, h: lh, rel0: 1, rel1: 0, g0, g1: glyphs.length })
      }
    }
    const rad = (deg * Math.PI) / 180
    const [cx, cy] = packed ? packed.at[n] : [cxs * rw, cys * rh]
    pics.push({ x: rx + cx, y: ry + cy, c: Math.cos(rad), s: Math.sin(rad), w: pw, h: ph, sheet: pc, rel0: 1, l0, l1: lines.length })
  })

  // The glyph sheet: every letter in every style the pictures use, once, at the screen's density.
  const cw = Math.ceil((fs * 1.3 + 2) * dpr), ch = Math.ceil((fs * 1.6 + 2) * dpr), cols = Math.max(1, Math.floor(2048 / cw))
  const { c: atlas, x: ax } = sheet(cols * cw, Math.ceil(Math.max(1, cellKeys.length) / cols) * ch)
  const cells = new Float32Array(cellKeys.length * 4)
  ax.textAlign = "center"
  cellKeys.forEach(([st, c], i) => {
    const X = (i % cols) * cw, Y = Math.floor(i / cols) * ch
    ax.setTransform(dpr, 0, 0, dpr, X, Y)
    ax.font = styles[st].font; ax.fillStyle = styles[st].color
    ax.fillText(c, cw / dpr / 2, ch / dpr / 2 + fs * 0.265)
    cells.set([X, Y, cw, ch], i * 4)
  })

  // Each letter's fall, fixed once: when it lets go (its line's height in its picture, bottom first, swept a little
  // from one side), where in its word it lands, and the hop, drift and turn of its arc.
  const N = glyphs.length
  const L: Laid = {
    still, pics, lines, atlas, cells,
    hx: new Float32Array(N), hy: new Float32Array(N), ha: new Float32Array(N), tx: new Float32Array(N), ty: new Float32Array(N),
    rel: new Float32Array(N), hop: new Float32Array(N), drift: new Float32Array(N), spin: new Float32Array(N), cell: new Int32Array(N), fly: new Uint8Array(N),
  }
  const span = new Map<number, [number, number]>()
  for (const g of glyphs) {
    const s = span.get(g.word) ?? [Infinity, -Infinity]
    span.set(g.word, [Math.min(s[0], g.ly), Math.max(s[1], g.ly)])
  }
  const rand = rng(20261011)
  pics.forEach((P) => {
    for (let li = P.l0; li < P.l1; li++) {
      const line = lines[li]
      for (let i = line.g0; i < line.g1; i++) {
        const g = glyphs[i], lx = g.lx - P.w / 2, ly = g.ly - P.h / 2
        L.hx[i] = P.x + lx * P.c - ly * P.s
        L.hy[i] = P.y + lx * P.s + ly * P.c
        L.ha[i] = Math.atan2(P.s, P.c)
        L.cell[i] = cellOf.get(g.st + "|" + g.ch)!
        const [top, bottom] = span.get(g.word)!, up = bottom > top ? (bottom - g.ly) / (bottom - top) : 0
        L.rel[i] = AT[g.word] + LET_GO * Math.min(1, 0.84 * up + 0.12 * (g.lx / P.w) + 0.04 * rand())
        const pts = ink0[g.word]
        if (pts && pts.length) {
          const j = Math.floor(rand() * (pts.length / 2)) * 2
          L.tx[i] = pts[j]; L.ty[i] = pts[j + 1]
        } else {
          L.tx[i] = L.hx[i]; L.ty[i] = H + 40
        }
        L.hop[i] = (phone ? 8 : 14) + rand() * (phone ? 18 : 34)
        L.drift[i] = (rand() - 0.5) * (phone ? 30 : 60)
        L.spin[i] = (rand() - 0.5) * 2.4
        L.fly[i] = rand() < FLY ? 1 : 0
        line.rel0 = Math.min(line.rel0, L.rel[i]); line.rel1 = Math.max(line.rel1, L.rel[i])
      }
      P.rel0 = Math.min(P.rel0, line.rel0)
    }
  })
  return L
}

function draw(f: Frame, L: Laid | null) {
  if (!L) return false
  const { ctx, dpr } = f
  // How far the held stage has been carried: 0 as it settles at the top of the window, 1 as it leaves.
  const s = L.still ? -1 : clamp01(-f.top / Math.max(1, f.height - f.vh))
  // What still hangs: a whole picture in one copy, or the lines of it that have not let go yet.
  for (const P of L.pics) {
    ctx.setTransform(dpr * P.c, dpr * P.s, -dpr * P.s, dpr * P.c, dpr * P.x, dpr * P.y)
    if (s <= P.rel0) {
      ctx.drawImage(P.sheet, -P.w / 2, -P.h / 2, P.w, P.h)
      continue
    }
    for (let i = P.l0; i < P.l1; i++) {
      const l = L.lines[i], gone = (s - l.rel0) / (l.rel1 - l.rel0 + FADE)
      if (gone >= 1) continue
      // A line letting go fades where it hung, as an afterimage, while half its letters leave it on their arcs.
      ctx.globalAlpha = gone > 0 ? 1 - gone : 1
      ctx.drawImage(P.sheet, l.x * dpr, l.y * dpr, l.w * dpr, l.h * dpr, l.x - P.w / 2, l.y - P.h / 2, l.w, l.h)
    }
    ctx.globalAlpha = 1
  }
  // The letters that leave: falling on their arcs, or settling into their word. Before a letter lets go, its line's
  // copy still shows it in place.
  const { hx, hy, ha, tx, ty, rel, hop, drift, spin, cell, fly, cells, atlas } = L
  for (const l of L.lines) {
    if (s <= l.rel0 || s >= l.rel1 + FALL) continue
    for (let i = l.g0; i < l.g1; i++) {
      const t = (s - rel[i]) / FALL
      if (!fly[i] || t <= 0 || t >= 1) continue
      const u = Math.min(1, t / FLIGHT), e = u * u * (3 - 2 * u)
      const x = hx[i] + (tx[i] - hx[i]) * u + drift[i] * Math.sin(Math.PI * u)
      const y = hy[i] - hop[i] * u + (ty[i] - hy[i] + hop[i]) * u * u
      const a = ha[i] + spin[i] * e, o = t > FLIGHT ? 1 - (t - FLIGHT) / (1 - FLIGHT) : 1
      // The glyph sheet is at the screen's density already, so the turn carries no scale.
      const c = Math.cos(a), sn = Math.sin(a), k = cell[i] * 4, cw = cells[k + 2], ch = cells[k + 3]
      ctx.globalAlpha = o
      ctx.setTransform(c, sn, -sn, c, x * dpr, y * dpr)
      ctx.drawImage(atlas, cells[k], cells[k + 1], cw, ch, -cw / 2, -ch / 2, cw, ch)
    }
  }
  ctx.globalAlpha = 1
  return false
}

export function Leaves() {
  const run = React.useRef<HTMLDivElement | null>(null)
  const list = React.useRef<HTMLParagraphElement | null>(null)
  const canvas = useStage<Laid | null>(run, { layout: (f) => lay(f, list.current), draw })
  return (
    <Sec
      id="leaves"
      num="02"
      name="What it leaves out"
      className="sec-leaves"
      title="What it leaves out."
      note="Each of these does a job that type can do on its own. So each one goes, on purpose."
      wide={
        <>
          <div className="leaves-run" ref={run}>
            <div className="leaves-stage">
              <canvas className="leaves-pictures" ref={canvas} aria-hidden="true" />
              <p className="leaves-list" ref={list}>
                {LEFT_OUT.map((w, i) => (
                  <span key={w} className="leaves-word">
                    <s className="leaves-strike" style={{ "--a": `${AT[i] * 100}%` } as React.CSSProperties}>
                      {w}
                    </s>
                    {i < LEFT_OUT.length - 1 ? ", " : "."}
                  </span>
                ))}
              </p>
            </div>
          </div>
          <p className="leaves-kept">
            Kept: <span className="leaves-k">words</span>, <span className="leaves-k">space</span> and <span className="leaves-k">one accent</span>
            <span className="leaves-stop">.</span>
          </p>
          <p className="leaves-sign">An icon stays only as a sign made of its own word.</p>
        </>
      }
    />
  )
}
