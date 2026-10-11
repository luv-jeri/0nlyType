// Shapes set in type, the way the wordmark's "Type" is written (scripts/set-wordmark.mjs): draw the shape, find every
// band of it wide enough to hold a line, and ask pretext for a line of the text exactly that wide. Fine, small type
// makes the shape; a shape is never a few bold letters stuffed into an outline. And strings: graphemes laid along a
// curve, each turned to it, for threads, knots and the crests of waves.

type Lib = typeof import("@chenglou/pretext")
type Prepared = ReturnType<Lib["prepareWithSegments"]>

/** One line of text set into a band of a shape: its left, top, the band's width, the text, and the width it is set to. */
export type ShapeLine = { x: number; y: number; w: number; text: string; fit: number }

const START = { segmentIndex: 0, graphemeIndex: 0 }
const measurer = () => {
  const c = typeof OffscreenCanvas === "undefined" ? document.createElement("canvas") : new OffscreenCanvas(1, 1)
  return c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
}
let pen: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
/** The width of `text` in `font`, by the canvas that draws it. */
export function measure(font: string, text: string) {
  pen ??= measurer()
  pen.font = font
  return pen.measureText(text).width
}

/**
 * Sets `text` (repeated as needed) into the shape `draw` paints, in lines `lh` tall at `font` (`fs` px). Only bands
 * inked along their top, middle and bottom count, so edges and hairlines are left to be drawn, and a band narrower
 * than `min` times the size is skipped. `w` and `h` are the shape's box in CSS pixels; `res` the raster's density.
 */
export function fillShape(lib: Lib, w: number, h: number, draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void, text: string, font: string, fs: number, lh: number, opts: { min?: number; res?: number; prepared?: Prepared } = {}) {
  const res = opts.res ?? 2, min = opts.min ?? 1.8
  const W = Math.max(1, Math.ceil(w * res)), H = Math.max(1, Math.ceil(h * res))
  const cv = typeof OffscreenCanvas === "undefined" ? Object.assign(document.createElement("canvas"), { width: W, height: H }) : new OffscreenCanvas(W, H)
  const x = cv.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  x.scale(res, res)
  x.fillStyle = "#000"; x.strokeStyle = "#000"
  draw(x)
  const img = x.getImageData(0, 0, W, H).data
  const inked = (px: number, py: number) => img[(py * W + px) * 4 + 3] > 200
  const prepared = opts.prepared ?? lib.prepareWithSegments(text, font)
  let cur = START
  const lines: ShapeLine[] = []
  for (let y = 0; y + lh <= h; y += lh) {
    const y0 = Math.round(y * res), y1 = Math.min(H - 1, Math.round((y + lh) * res) - 1), ym = (y0 + y1) >> 1
    let run = -1
    for (let px = 0; px <= W; px++) {
      const on = px < W && inked(px, y0) && inked(px, y1) && inked(px, ym)
      if (on && run < 0) run = px
      if (!on && run >= 0) {
        const rx = run / res, rw = (px - run) / res
        run = -1
        if (rw < fs * min) continue
        let line = lib.layoutNextLine(prepared, cur, rw)
        if (!line) { cur = START; line = lib.layoutNextLine(prepared, cur, rw) }
        if (!line) continue
        cur = line.end
        const t = line.text.replace(/^[\s·]+|[\s·]+$/g, "")
        if (!t) continue
        lines.push({ x: rx, y, w: rw, text: t, fit: justify(font, t, rw, fs) })
      }
    }
  }
  return lines
}

/** Justified as the wordmark sets it: by the word gaps, or in a single word by letter space up to 0.3 of the size. */
export function justify(font: string, t: string, rw: number, fs: number) {
  const nat = measure(font, t), gaps = (t.match(/ /g) || []).length, n = [...t].length
  return gaps ? rw : Math.min(rw, nat + fs * 0.3 * Math.max(0, n - 1))
}

/** Draws a set line, spread to its fit width by word space or letter space. `baseline` is the share of lh to the baseline. */
export function drawLine(ctx: CanvasRenderingContext2D, l: ShapeLine, lh: number, baseline = 0.78) {
  const nat = ctx.measureText(l.text).width, gaps = (l.text.match(/ /g) || []).length, n = [...l.text].length
  const extra = Math.max(0, l.fit - nat)
  ctx.wordSpacing = gaps ? `${extra / gaps}px` : "0px"
  ctx.letterSpacing = gaps ? "0px" : `${extra / Math.max(1, n - 1)}px`
  ctx.fillText(l.text, l.x, l.y + lh * baseline)
  ctx.wordSpacing = "0px"; ctx.letterSpacing = "0px"
}

/** One grapheme placed on a curve: its centre, the curve's angle there, and the grapheme. */
export type Placed = { x: number; y: number; a: number; g: string; w: number }

const graphemes = (t: string) => {
  const S = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter
  return S ? [...new S(undefined, { granularity: "grapheme" }).segment(t)].map((s) => s.segment) : [...t]
}

/** Each grapheme's advance in `font`, so a string can be laid along any curve without measuring again per frame. */
export function advances(font: string, text: string) {
  return graphemes(text).map((g) => ({ g, w: measure(font, g) }))
}

/**
 * Lays graphemes (from `advances`) along the polyline `pts` ([x0, y0, x1, y1, ...]) from `offset` px along it, each
 * centred on the curve and turned to its tangent. Stops at the curve's end.
 */
export function alongPath(pts: ArrayLike<number>, glyphs: { g: string; w: number }[], offset = 0, gap = 0): Placed[] {
  const out: Placed[] = []
  let seg = 0, segLen = 0, segStart = 0
  const n = pts.length / 2
  const lenOf = (i: number) => Math.hypot(pts[2 * i + 2] - pts[2 * i], pts[2 * i + 3] - pts[2 * i + 1])
  if (n < 2) return out
  segLen = lenOf(0)
  let s = offset
  for (const { g, w } of glyphs) {
    const mid = s + w / 2
    while (seg < n - 2 && mid > segStart + segLen) { segStart += segLen; seg++; segLen = lenOf(seg) }
    if (mid > segStart + segLen) break
    const t = segLen ? (mid - segStart) / segLen : 0
    const x0 = pts[2 * seg], y0 = pts[2 * seg + 1], x1 = pts[2 * seg + 2], y1 = pts[2 * seg + 3]
    if (mid >= 0) out.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, a: Math.atan2(y1 - y0, x1 - x0), g, w })
    s += w + gap
  }
  return out
}

/** Draws placed graphemes, each turned to its curve and centred on it, inside whatever transform the context has. */
export function drawPlaced(ctx: CanvasRenderingContext2D, placed: Placed[]) {
  const m = ctx.getTransform()
  ctx.textAlign = "center"; ctx.textBaseline = "middle"
  for (const q of placed) {
    const c = Math.cos(q.a), s = Math.sin(q.a)
    ctx.setTransform(m.a * c + m.c * s, m.b * c + m.d * s, m.c * c - m.a * s, m.d * c - m.b * s, m.a * q.x + m.c * q.y + m.e, m.b * q.x + m.d * q.y + m.f)
    ctx.fillText(q.g, 0, 0)
  }
  ctx.setTransform(m)
  ctx.textAlign = "start"; ctx.textBaseline = "alphabetic"
}
