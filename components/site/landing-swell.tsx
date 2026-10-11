"use client"

import * as React from "react"

import { useStage, type Frame } from "@/components/site/stage"

// The pieces' title, floating in a sea set in their names, as the sea of words on the poster for Jaws. The sea fills
// the whole box. It is three swells, one under another; each swell's lines follow its crest and flatten as they go
// down, and each swell is laid over the one above it, so the lines of the swell behind are cut off where the next one
// rises, as a wave hides the water behind it. The swells roll slowly by themselves, each at its own pace. The title
// floats in it, as the whale's tail and the shark do in theirs, a word at a time, in its own heavy face: the count, large,
// and "pieces." ride the middle swell, "Turn to one." the front one, each word rising and tilting with the water under
// it, cutting the words around it with a rim of paper, its foot under the swell in front. A screen reader still hears
// the title as text. Where the box is too short for the title to float, the sea stops over the title instead.
// The sea moves only while the sheet is on screen and in view (the sheet fades in over the hero, so
// "on screen" alone is not enough); under reduced motion it is drawn once, becalmed. On a phone the sheet is not a box
// and there is no sea: the canvas is not shown, and the title is only the title.

const REACH = 110 // the depth of sea each swell is given when the sea only tops the title
const ROLL = 0.00055 // radians a millisecond: one swell's roll takes about eleven seconds
const BIG = 1.5 // the count, to the title's words
const SUNK = 0.07 // how much of a word's height is under water
const GAP = 1.8 // the space between floating words, in spaces: each word's rim of paper takes some of it

type Swell = { top: number; rows: number; A: number; k: number; w: number; phase: number }

type Word = { text: string; font: string; size: number; x: number; ride: number } // x: its middle; ride: its swell

type Sea = {
  chars: string[]
  sprite: Map<string, HTMLCanvasElement>
  widths: Map<string, number>
  top: number // a sprite's baseline, from its top
  fs: number
  lh: number
  bottom: number // where the sea ends
  swells: Swell[]
  words: Word[] // empty where the title does not float
  cap: number // the face's cap height, to its size
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

// A swell that carries words is long and low (`calm`), so a word as wide as half the box still sits level on it.
function swell(i: number, top: number, bottom: number, lh: number, A: number, w: number, calm = false): Swell {
  return {
    top,
    rows: Math.ceil((bottom - top) / lh) + 1,
    A: A * (1 - i * 0.18) * (calm ? 0.6 : 1),
    k: (Math.PI * 2) / (w * (calm ? 1.3 - i * 0.2 : 0.7 - i * 0.12)),
    w: ROLL * (1 + i * 0.35),
    phase: i * 2.1,
  }
}

// The title's face at a size, as the canvas sets it: heavy, condensed and drawn a little tight, as the heading is.
const face = (size: number, voice: string) => `800 ${size}px ${voice}`
function setFace(c: CanvasRenderingContext2D, size: number, voice: string) {
  c.font = face(size, voice)
  c.fontStretch = "condensed"
  c.letterSpacing = `${-0.035 * size}px`
}

function set(f: Frame, names: string, count: string, title: { top: number; size: number; pad: number }): Sea | null {
  const { w, h, dpr, ink } = f
  if (w < 120 || h < 60 || w * h > 4e6) return null
  const probe = document.createElement("canvas").getContext("2d")!

  // The title, measured at 100px: the count and "pieces." on one line, "Turn to one." on the next.
  setFace(probe, 100, ink.voice)
  const lineA = [count, "pieces."], lineB = ["Turn", "to", "one."]
  const at100 = new Map([...lineA, ...lineB, " "].map((t) => [t, probe.measureText(t).width]))
  const wid = (t: string) => at100.get(t)!
  const cap = probe.measureText("Turn").actualBoundingBoxAscent / 100, space = wid(" ")
  const across = (line: string[], first = 1) => line.reduce((a, t, i) => a + wid(t) * (i ? 1 : first), 0) + space * GAP * (line.length - 1)

  // The size the title can float at: as wide as the box allows, and short enough for a sea above, between and under.
  const fs = clamp(h / 30, 7, 11), lh = fs * 1.22, A = Math.min(lh * 1.6, h / 14)
  const under = Math.max(lh * 3, title.pad * 2), first = A + fs * 1.4
  const room = w - title.pad * 2
  const size = Math.min(
    title.size * 1.2,
    (room * 100) / across(lineB),
    (room * 100) / across(lineA, BIG),
    (h - under - first - A * 4 - lh * 4) / (cap * (1 - SUNK) * (1 + BIG)),
  )
  const afloat = size >= 28

  // The sea: when the title floats, the whole box; otherwise down to a little over the title.
  const fs0 = afloat ? fs : clamp(Math.min(h, title.top) / 26, 7, 11)
  const bottom = afloat ? h + fs0 * 1.5 : Math.min(h, title.top) - fs0 * 2
  if (bottom < 44) return null
  const lh0 = fs0 * 1.22
  const font = `600 ${fs0}px ${ink.voice}`
  probe.font = font
  probe.fontStretch = "normal"
  probe.letterSpacing = "0px"
  const widths = new Map<string, number>()
  const chars = Array.from(Array(6).fill(names).join(" "))
  for (const c of new Set(chars)) widths.set(c, probe.measureText(c).width)

  // Each letter drawn once, at the screen's density; a frame is a few thousand copies of them, each turned to its wave.
  const sprite = new Map<string, HTMLCanvasElement>()
  const top = fs0 * 1.1
  for (const c of widths.keys()) {
    if (c === " ") continue
    const cv = document.createElement("canvas")
    cv.width = Math.ceil((widths.get(c)! + 2) * dpr); cv.height = Math.ceil(fs0 * 1.5 * dpr)
    const s = cv.getContext("2d")!
    s.setTransform(dpr, 0, 0, dpr, 0, 0)
    s.font = font
    s.fillStyle = ink.ink
    s.fillText(c, 1, top)
    sprite.set(c, cv)
  }

  if (!afloat) {
    // The swells: the first crest a little under the top, so it has room to rise, the rest spaced down to the title.
    const many = clamp(Math.round(bottom / REACH), 1, 3)
    const A0 = Math.min(lh0 * 2.2, bottom / (many * 3)), top0 = A0 + fs0 * 1.4, span = (bottom - top0) / many
    const swells = Array.from({ length: many }, (_, i) => swell(i, top0 + i * span, bottom, lh0, A0, w))
    return { chars, sprite, widths, top, fs: fs0, lh: lh0, bottom, swells, words: [], cap }
  }

  // Three swells: the sea behind, the swell the first line rides, and the front swell the second line rides. A word
  // rides a swell's surface, which is a line and a little over the swell's top (see `surface` in draw).
  const lift = fs * 1.15
  const front = h - under + lift
  const middle = front - lift - size * cap * (1 - SUNK) - A * 2 - lh * 2 + lift
  const swells = [swell(0, first, bottom, lh, A, w), swell(1, middle, bottom, lh, A, w, true), swell(2, front, bottom, lh, A, w, true)]
  const words: Word[] = []
  const lay = (line: string[], ride: number, big: number) => {
    let x = title.pad
    line.forEach((t, i) => {
      const s = size * (i ? 1 : big), tw = (wid(t) * s) / 100
      words.push({ text: t, font: face(s, ink.voice), size: s, x: x + tw / 2, ride })
      x += tw + (space * GAP * size) / 100
    })
  }
  lay(lineA, 1, BIG)
  lay(lineB, 2, 1)
  return { chars, sprite, widths, top, fs, lh, bottom, swells, words, cap }
}

function draw(f: Frame, sea: Sea | null, shown: () => boolean) {
  if (!sea || !shown()) return false
  const { ctx, w, dpr, now, still } = f
  const t = still ? 0 : now
  const lift = (s: Swell, j: number, x: number) => {
    const fall = Math.pow(Math.max(0, 1 - j / s.rows), 1.4)
    return s.A * fall * Math.sin(s.k * x + s.phase + s.w * t) + s.A * 0.18 * fall * Math.sin(s.k * 2.3 * x - s.w * 1.7 * t)
  }
  const slope = (s: Swell, j: number, x: number) => (lift(s, j, x + 1) - lift(s, j, x - 1)) / 2
  const surface = (s: Swell, x: number) => s.top + lift(s, 0, x) - sea.fs * 1.15
  // A word floats on the surface of its swell, so it rises, falls and tilts with that water; the swell, drawn next,
  // covers its foot.
  const float = (o: Word, s: Swell) => {
    const y = surface(s, o.x) + o.size * sea.cap * SUNK, a = Math.atan(slope(s, 0, o.x)) * 0.6
    ctx.setTransform(dpr * Math.cos(a), dpr * Math.sin(a), -dpr * Math.sin(a), dpr * Math.cos(a), o.x * dpr, y * dpr)
    ctx.font = o.font
    ctx.fontStretch = "condensed"
    ctx.letterSpacing = `${-0.035 * o.size}px`
    ctx.textAlign = "center"
    ctx.lineJoin = "round"
    ctx.globalCompositeOperation = "destination-out"
    ctx.lineWidth = Math.max(6, o.size * 0.08)
    ctx.strokeText(o.text, 0, 0)
    ctx.globalCompositeOperation = "source-over"
    ctx.fillStyle = f.ink.ink
    ctx.fillText(o.text, 0, 0)
    ctx.textAlign = "start"
    ctx.fontStretch = "normal"
    ctx.letterSpacing = "0px"
  }

  sea.swells.forEach((s, b) => {
    // The swell clears the water behind it: everything under its crest, down to the foot of the sea, is paper again.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalCompositeOperation = "destination-out"
    ctx.beginPath()
    ctx.moveTo(0, sea.bottom)
    for (let x = 0; x <= w + 4; x += 4) ctx.lineTo(x, surface(s, x))
    ctx.lineTo(w + 4, sea.bottom)
    ctx.closePath()
    ctx.fill()
    ctx.globalCompositeOperation = "source-over"
    // Lines the next swell will surely cover are not drawn at all.
    const next = sea.swells[b + 1], hidden = next ? next.top + next.A * 1.18 + s.A * 1.18 + sea.fs : Infinity
    for (let j = 0; j < s.rows; j++) {
      const y0 = s.top + j * sea.lh
      if (y0 > sea.bottom || y0 > hidden) break
      let at = (j * 53 + b * 211) % sea.chars.length, x = -((j * 7 + b * 3) % 11)
      while (x < w) {
        const c = sea.chars[at]
        at = (at + 1) % sea.chars.length
        const cw = sea.widths.get(c)!
        const sp = sea.sprite.get(c)
        const y = y0 + lift(s, j, x + cw / 2)
        if (sp && y < sea.bottom) {
          const a = Math.atan(slope(s, j, x + cw / 2)), cos = Math.cos(a) * dpr, sin = Math.sin(a) * dpr
          ctx.setTransform(cos, sin, -sin, cos, x * dpr, y * dpr)
          ctx.drawImage(sp, -1, -sea.top, sp.width / dpr, sp.height / dpr)
        }
        x += cw
      }
    }
    // The words riding the next swell are drawn over this one; the next swell, drawn after them, covers their feet.
    for (const o of sea.words) if (o.ride === b + 1) float(o, sea.swells[b + 1])
  })
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  // The sea rolls on while it is in view (the stage stops asking for frames when it is off screen; a scroll asks again).
  return !still
}

/** The pieces' title, under a sea of their names that rolls by itself. */
export function PiecesTitle({ count, names }: { count: number; names: string[] }) {
  const host = React.useRef<HTMLHeadingElement>(null)
  const text = React.useMemo(() => names.join(" "), [names])
  // The sheet fades in over the hero by the scroll; while it is clear, there is no sea to roll.
  const shown = React.useCallback(() => {
    const part = host.current?.closest<HTMLElement>(".pieces-part")
    return !part || Number(getComputedStyle(part).opacity) > 0.01
  }, [])
  const canvas = useStage<Sea | null>(host, {
    layout: (f) => {
      const el = host.current, words = el?.querySelector<HTMLElement>(".pt-words")
      const css = el ? getComputedStyle(el) : null
      const title = { top: words ? words.offsetTop : f.h, size: css ? parseFloat(css.fontSize) : 64, pad: css ? parseFloat(css.paddingInlineStart) : 16 }
      const sea = set(f, text, String(count), title)
      if (el) el.toggleAttribute("data-afloat", !!sea?.words.length)
      return sea
    },
    draw: (f, sea) => draw(f, sea, shown),
  })
  return (
    <h2 ref={host} className="pieces-title" id="pieces">
      <canvas ref={canvas} className="pt-sea" aria-hidden="true" />
      <span className="pt-words">
        <span className="pt-n">{count} </span>pieces.
        <br />
        Turn to one.
      </span>
    </h2>
  )
}
