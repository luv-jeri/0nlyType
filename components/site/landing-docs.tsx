"use client"

import NextLink from "next/link"
import * as React from "react"

import { breath, span, useStage, type Frame } from "@/components/site/stage"

// The way into the docs, set as a page of a magazine: "Read docs" in the voice's roman, large and solid, and the
// names of the pieces run around it, fine as a halftone, the way a column of type is run around a picture. Pretext sets
// the run: each line is cut where it meets a letter, a rim of paper short of it, and every piece of the line between
// letters is filled from the same running text, so the names read on around the words rather than under them.
// Pointed at or reached by the keyboard, the solid words empty to their outline and the names pour into them: every
// place inside a letter's stroke is filled by a letter that travels in from the run, turning into the letter that place
// needs as it goes, and the letters left over sink a little and fade, so the words are left written in the names, as
// the italic of the wordmark is written in its creed. It moves as a wave from the left and runs back the same way when
// the pointer leaves. At rest and turned the box is drawn crisp; the letters travel whole only in between.

const WORDS = "Read docs"
const IN = 1200, OUT = 1000 // ms for the whole wave, turning and returning
const WAVE = 0.42 // the share of the run the wave takes to cross the box; each letter moves for the rest

type Glyph = { x: number; y: number; c: string; d: number }
type Mover = Glyph & { fx: number; fy: number; fc: string | null }
type Field = {
  rest: HTMLCanvasElement
  turn: HTMLCanvasElement
  solid: HTMLCanvasElement
  outline: HTMLCanvasElement
  // Letters of the run that do not travel, and the places inside the words with the letter bound for each.
  stay: Glyph[]
  move: Mover[]
  sprite: Map<string, HTMLCanvasElement>
  top: number // a sprite's baseline, from its top, in CSS pixels
  P: number // 0 at rest, 1 turned
  t: number // the last frame's time; -1 before the first, which shows the side asked for without moving
}
type Run = { prepared: ReturnType<Frame["lib"]["prepareWithSegments"]>; at: { segmentIndex: number; graphemeIndex: number } }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
// A fixed scatter, the same at every layout, so a letter's delay never jumps on resize.
const jitter = (i: number) => {
  const s = Math.sin(i * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

function set(f: Frame, names: string): Field | null {
  const { w, h, dpr, lib, ink } = f
  // A box measured mid-layout can be absurdly tall for a moment; reading its pixels back would fail, so wait for the next.
  if (w < 40 || h < 40 || w * h > 4e6) return null
  const sheet = () => {
    const cv = document.createElement("canvas")
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
    const g = cv.getContext("2d", { willReadFrequently: true })!
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    return [cv, g] as const
  }
  const W = Math.round(w * dpr), H = Math.round(h * dpr)
  const alpha = (cv: HTMLCanvasElement) => cv.getContext("2d")!.getImageData(0, 0, W, H).data

  // The words: in the voice's roman (it is the page's own action, not anything the person wrote), as large as the box takes them, on one line, or as "Read" over "docs" when
  // that is much larger, "docs" set to the right, so the pair steps down the box as a headline does.
  const face = (size: number) => `800 ${size}px ${ink.voice}`
  const [, m] = sheet()
  m.font = face(100)
  const ink100 = (l: string) => {
    const x = m.measureText(l)
    return { l: x.actualBoundingBoxLeft, r: x.actualBoundingBoxRight, up: x.actualBoundingBoxAscent, down: x.actualBoundingBoxDescent }
  }
  const inset = Math.round(Math.min(w, h) * 0.07), room = { w: w - 2 * inset, h: h - 2 * inset }
  const lead = 4 // between the lines, per 100px of type
  const solo = ink100(WORDS)
  const one = 100 * Math.min(room.w / (solo.l + solo.r), room.h / (solo.up + solo.down))
  const [a, b] = WORDS.split(" ").map(ink100)
  const two = 100 * Math.min(room.w / Math.max(a.l + a.r, b.l + b.r), room.h / (a.up + a.down + lead + b.up + b.down))
  const at: [string, number, number][] = [] // each line and where its pen stands
  let size: number
  if (two > one * 1.25) {
    size = two
    const k = size / 100, top = (h - (a.up + a.down + lead + b.up + b.down) * k) / 2
    const [ra, rb] = WORDS.split(" ")
    at.push([ra, inset + a.l * k, top + a.up * k])
    at.push([rb, w - inset - b.r * k, top + (a.up + a.down + lead + b.up) * k])
  } else {
    size = one
    const k = size / 100
    at.push([WORDS, (w - (solo.l + solo.r) * k) / 2 + solo.l * k, (h - (solo.up + solo.down) * k) / 2 + solo.up * k])
  }
  const words = (g: CanvasRenderingContext2D, how: "fill" | "stroke") => {
    g.font = face(size)
    for (const [l, x, y] of at) {
      if (how === "fill") g.fillText(l, x, y)
      else g.strokeText(l, x, y)
    }
  }

  // The field's letters, and the two masks the run is set by: the words themselves, and the words grown by a rim.
  const fs = clamp(Math.min(w, h) / 44, 4, 5.5), lh = fs * 1.04, rim = Math.max(3, fs * 1.1)
  const font = `600 ${fs}px ${ink.voice}`
  const [cutCv, cut] = sheet()
  words(cut, "fill")
  const [keepCv, keep] = sheet()
  keep.lineWidth = rim * 2
  keep.lineJoin = "round"
  words(keep, "fill")
  words(keep, "stroke")
  const inWords = alpha(cutCv), nearWords = alpha(keepCv)

  // Where a line may run, across the band of rows a line of the field covers: free of the grown words, or within the
  // words at both the top and the foot of the field's small letters.
  const spans = (rows: number[], ok: (r: number, c: number) => boolean, least: number) => {
    const open = new Uint8Array(W).fill(1)
    for (const y of rows) {
      const r = clamp(Math.round(y * dpr), 0, H - 1)
      for (let c = 0; c < W; c++) if (open[c] && !ok(r, c)) open[c] = 0
    }
    const out: [number, number][] = []
    let s = -1
    for (let c = 0; c <= W; c++) {
      const yes = c < W && open[c] === 1
      if (yes && s < 0) s = c
      else if (!yes && s >= 0) {
        if ((c - s) / dpr >= least) out.push([s / dpr, c / dpr])
        s = -1
      }
    }
    return out
  }
  const free = (r: number, c: number) => nearWords[(r * W + c) * 4 + 3] < 40
  const within = (r: number, c: number) => inWords[(r * W + c) * 4 + 3] > 127

  const [, g] = sheet()
  g.font = font
  const widths = new Map<string, number>()
  const cw = (s: string) => widths.get(s) ?? (widths.set(s, g.measureText(s).width), widths.get(s)!)
  const text = Array(12).fill(names).join(" ")
  const start = () => ({ segmentIndex: 0, graphemeIndex: 0 })
  const around: Run = { prepared: lib.prepareWithSegments(text, font), at: start() }
  const inside: Run = { prepared: lib.prepareWithSegments(text, font), at: start() }
  // One piece of a line, from x0 to x1: the next line of the run that fits it, its spare width shared among its spaces
  // (only while that keeps the spaces a word's width; past that it stays ragged, as a short measure does).
  const set1 = (run: Run, x0: number, x1: number, y: number, into: Glyph[]) => {
    let line = lib.layoutNextLine(run.prepared, run.at, x1 - x0)
    if (!line) {
      run.at = start()
      line = lib.layoutNextLine(run.prepared, run.at, x1 - x0)
    }
    if (!line) return
    run.at = line.end
    const chars = Array.from(line.text.trim())
    const gaps = chars.filter((s) => s === " ").length
    const extra = gaps ? (x1 - x0 - chars.reduce((s, c) => s + cw(c), 0)) / gaps : 0
    const share = extra > 0 && extra < fs * 3 ? extra : 0
    let x = x0
    for (const c of chars) {
      if (c !== " " && x + cw(c) <= x1 + 0.5) into.push({ x, y, c, d: 0 })
      x += cw(c) + (c === " " ? share : 0)
    }
  }
  const out: Glyph[] = [], into: Glyph[] = []
  for (let y = fs * 0.8; y < h + fs; y += lh) {
    for (const [x0, x1] of spans([y - fs * 0.85, y - fs * 0.4, y + fs * 0.25], free, fs * 4)) set1(around, x0, x1, y, out)
    for (const [x0, x1] of spans([y - fs * 0.72, y - fs * 0.05], within, fs * 1.2)) set1(inside, x0, x1, y, into)
  }

  // The four crisp layers: the words solid and as a hairline, and the run around them and the names within them.
  const layer = (draw: (c: CanvasRenderingContext2D) => void) => {
    const [cv, c] = sheet()
    c.fillStyle = c.strokeStyle = ink.ink
    draw(c)
    return cv
  }
  const solid = layer((c) => words(c, "fill"))
  const outline = layer((c) => {
    c.lineWidth = 0.75
    words(c, "stroke")
  })
  const type = (list: Glyph[]) => (c: CanvasRenderingContext2D) => {
    c.font = font
    for (const q of list) c.fillText(q.c, q.x, q.y)
  }
  const rest = layer((c) => {
    c.drawImage(solid, 0, 0, w, h)
    type(out)(c)
  })
  const turn = layer((c) => {
    c.drawImage(outline, 0, 0, w, h)
    type(into)(c)
  })

  // Who travels where: the places in the words and the letters of the run are both taken from left to right, and each
  // place is given the letter at the same share of the way along, so letters mostly fall in from above and below their
  // place rather than cross the box. A place with no letter left for it fades in where it stands. A letter is held back
  // by how far along its place stands, and a little more, so the wave is not a ruler.
  const byX = (p: Glyph, q: Glyph) => p.x - q.x || p.y - q.y
  const pool = [...out].sort(byX), places = [...into].sort(byX)
  const taken = new Set<Glyph>()
  const delay = (x: number, i: number) => WAVE * (0.85 * (x / w) + 0.15 * jitter(i))
  const move: Mover[] = places.map((q, k) => {
    const from = pool.length ? pool[Math.min(pool.length - 1, Math.floor(((k + 0.5) * pool.length) / places.length))] : undefined
    const open = from && !taken.has(from) ? from : undefined
    if (open) taken.add(open)
    return { ...q, d: delay(q.x, k), fx: open?.x ?? q.x, fy: open?.y ?? q.y, fc: open?.c ?? null }
  })
  const stay = out.filter((q) => !taken.has(q)).map((q, i) => ({ ...q, d: delay(q.x, i + 7919) }))

  // Each letter drawn once, at the screen's density, so a frame of thousands of letters is thousands of copies.
  const sprite = new Map<string, HTMLCanvasElement>()
  const spriteTop = fs * 1.1
  for (const c of new Set([...out, ...into].map((q) => q.c))) {
    const cv = document.createElement("canvas")
    cv.width = Math.ceil((cw(c) + 2) * dpr)
    cv.height = Math.ceil(fs * 1.5 * dpr)
    const s = cv.getContext("2d")!
    s.setTransform(dpr, 0, 0, dpr, 0, 0)
    s.font = font
    s.fillStyle = ink.ink
    s.fillText(c, 1, spriteTop)
    sprite.set(c, cv)
  }

  return { rest, turn, solid, outline, stay, move, sprite, top: spriteTop, P: 0, t: -1 }
}

function draw(f: Frame, field: Field | null, want: boolean) {
  if (!field) return false
  const { ctx, w, h, dpr, now, still } = f
  const aim = want ? 1 : 0
  if (field.t < 0 || still) field.P = aim
  else {
    // The stage sleeps between turns, so the time since the last frame can be long: a step is never more than two frames.
    const dt = Math.min(now - field.t, 34)
    field.P = aim > field.P ? Math.min(1, field.P + dt / IN) : Math.max(0, field.P - dt / OUT)
  }
  field.t = now
  const P = field.P
  if (P === 0 || P === 1) {
    ctx.drawImage(P ? field.turn : field.rest, 0, 0, w, h)
    return false
  }
  // In between: the solid words empty as their outline draws in, and the letters travel over them; near either end
  // the crisp side is laid over the letters as they settle into it.
  ctx.globalAlpha = 1 - breath(span(P, 0.05, 0.6))
  ctx.drawImage(field.solid, 0, 0, w, h)
  ctx.globalAlpha = breath(span(P, 0.35, 0.95))
  ctx.drawImage(field.outline, 0, 0, w, h)
  const put = (c: string, x: number, y: number, alpha: number) => {
    const s = field.sprite.get(c)
    if (!s || alpha < 0.01) return
    ctx.globalAlpha = alpha
    ctx.drawImage(s, x - 1, y - field.top, s.width / dpr, s.height / dpr)
  }
  const local = (d: number) => breath(span(P, d, d + 1 - WAVE))
  for (const q of field.stay) {
    const e = local(q.d)
    put(q.c, q.x, q.y + e * 3, 1 - e)
  }
  for (const q of field.move) {
    const e = local(q.d)
    if (q.fc === null) {
      put(q.c, q.x, q.y, e)
      continue
    }
    // Along a shallow arc, turning from the letter it was into the letter its place needs over the middle of the way.
    const x = q.fx + (q.x - q.fx) * e, y = q.fy + (q.y - q.fy) * e - Math.sin(Math.PI * e) * 4
    const turn = span(e, 0.4, 0.85)
    if (q.fc === q.c) put(q.c, x, y, 1)
    else {
      put(q.fc, x, y, 1 - turn)
      put(q.c, x, y, turn)
    }
  }
  const settle = Math.max(1 - span(P, 0, 0.1), span(P, 0.86, 1))
  if (settle > 0) {
    ctx.globalAlpha = settle
    ctx.drawImage(P < 0.5 ? field.rest : field.turn, 0, 0, w, h)
  }
  ctx.globalAlpha = 1
  return true
}

/** "Read docs" in the roman with the pieces' names run around it; pointed at, the names pour into the words. */
export function DocsField({ href, names }: { href: string; names: string[] }) {
  const host = React.useRef<HTMLAnchorElement>(null)
  const text = React.useMemo(() => names.join(" "), [names])
  const canvas = useStage<Field | null>(host, {
    layout: (f) => {
      const field = set(f, text)
      if (field && host.current) host.current.dataset.laid = ""
      return field
    },
    draw: (f, field) => draw(f, field, !!host.current?.matches(":hover, :focus-visible")),
  })
  return (
    <NextLink ref={host} href={href} prefetch={false} className="hero-docs">
      <span className="hd-words">{WORDS}</span>
      <canvas ref={canvas} className="hd-field" aria-hidden="true" />
    </NextLink>
  )
}
