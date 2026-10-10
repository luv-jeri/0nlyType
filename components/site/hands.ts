import type { Hands } from "@/lib/site/hands"

// The hero's two hands, set in real letters the way an engraver cuts a plate. Each hand's outline is filled row by
// row with whole words, broken by Pretext to fit each span and justified to its edges like a calligram. Every
// letter takes its tone from the fresco's light where it sits: shadow is set heavy in full ink, light is set thin
// and faint, and letters on the outline keep their ink so the silhouette holds. The letters are stamped from a sheet
// set once per layout, so a frame is image copies, not text layout. Laying a hand out is sliced: it pauses between rows,
// so a slow phone gives each frame back instead of holding the page for the whole hand. Each letter also knows the
// phrase it was set from and has a bold cut on the sheet, so a pointer can read one phrase out of the hand.

type Lib = typeof import("@chenglou/pretext")
type Cursor = { segmentIndex: number; graphemeIndex: number }

/**
 * One hand, laid out: each letter's place in its box, its ink, its sheet cell and its bold cell, how far it is from
 * the fingertip, and its phrase (an index into `phrases`, the hand's distinct phrases, each set as one line of text).
 */
export type Hand = {
  n: number
  fs: number
  x: Float32Array
  y: Float32Array
  alpha: Float32Array
  cell: Uint16Array
  bold: Uint16Array
  reach: Float32Array
  phrase: Uint16Array
  phrases: string[]
  box: { x: number; y: number; w: number; h: number }
  sheet: HTMLCanvasElement
  cells: { x: number; y: number; w: number; h: number }[]
  res: number
}

/**
 * What a pointer is doing to a hand, in the hand's box: a loupe at `x`, `y` of radius `r` and strength `s` (0 to 1)
 * that lifts the ink under it, swells the letters by up to `grow` and spreads them as a lens does; the phrase `lit`
 * read in full ink at `litA`, the one before it, `was`, letting go at `wasA`; and `dim`, how far the rest of the
 * hand steps back while a phrase is read.
 */
export type Touch = { x: number; y: number; r: number; s: number; grow: number; lit: number; litA: number; was: number; wasA: number; dim: number }

/** Where a hand lands: stage pixels per cell of the grid, and the stage point its fingertip touches. */
export type Place = { k: number; tip: { x: number; y: number } }

export function decodeHands(h: Hands) {
  const grid = new Uint8Array(h.w * h.h)
  h.rows.forEach((row, y) => {
    let x = 0
    for (const m of row.matchAll(/([.a-p])(\d*)/g)) {
      const n = m[2] ? Number(m[2]) : 1
      if (m[1] !== ".") grid.fill(m[1].charCodeAt(0) - 96, y * h.w + x, y * h.w + x + n)
      x += n
    }
  })
  return grid
}

/** The rows a hand's ink spans in the grid between columns `from` and `to`, so a layout can fit what is on screen. */
export function extent(h: Hands, grid: Uint8Array, side: 0 | 1, from = 0, to = h.w) {
  const c0 = Math.max(side ? h.split : 0, Math.floor(from)), c1 = Math.min(side ? h.w : h.split, Math.ceil(to))
  let top = h.h, bottom = 0
  for (let r = 0; r < h.h; r++)
    for (let c = c0; c < c1; c++)
      if (grid[r * h.w + c]) {
        top = Math.min(top, r)
        bottom = r + 1
        break
      }
  return { top, bottom }
}

/** How much of the stage a hand covers at a place, clipped to [0, W]: the letter budget is shared over it. */
export function area(h: Hands, grid: Uint8Array, side: 0 | 1, p: Place, W: number) {
  const c0 = side ? h.split : 0, c1 = side ? h.w : h.split, tip = side ? h.god : h.adam
  let n = 0
  for (let c = c0; c < c1; c++) {
    const x = p.tip.x + (c - tip[0]) * p.k
    if (x < 0 || x > W) continue
    for (let r = 0; r < h.h; r++) if (grid[r * h.w + c]) n++
  }
  return n * p.k * p.k
}

/**
 * Lays one hand out at `p`: `text` is what it is written in, `fonts` the four tones' fonts (deepest first), `fs` the
 * letter size; `W` clips it to the stage, and `res` is the sheet's resolution (device pixels per CSS pixel). It yields
 * between steps, so the caller runs it a few milliseconds at a time; it returns the hand.
 */
export function* setHand(lib: Lib, h: Hands, grid: Uint8Array, side: 0 | 1, p: Place, text: string, fonts: string[], inks: string[], fs: number, W: number, res: number): Generator<void, Hand> {
  const c0 = side ? h.split : 0, c1 = side ? h.w : h.split, tip = side ? h.god : h.adam
  const toC = (x: number) => (x - p.tip.x) / p.k + tip[0]
  const toR = (y: number) => (y - p.tip.y) / p.k + tip[1]
  const toX = (c: number) => p.tip.x + (c - tip[0]) * p.k
  const at = (x: number, y: number) => {
    const c = Math.floor(toC(x)), r = Math.floor(toR(y))
    return c < c0 || c >= c1 || r < 0 || r >= h.h ? 0 : grid[r * h.w + c]
  }

  // The tones: the hand's own shades cut at fixed shares, so each hand has its full range, shadow to light.
  const count = new Array<number>(17).fill(0)
  let total = 0
  for (let r = 0; r < h.h; r++)
    for (let c = c0; c < c1; c++) {
      const v = grid[r * h.w + c]
      if (v) {
        count[v]++
        total++
      }
    }
  const q = (f: number) => {
    let s = 0
    for (let v = 1; v <= 16; v++) if ((s += count[v]) >= f * total) return v
    return 16
  }
  const cut = [q(0.18), q(0.42), q(0.72)]

  const measure = document.createElement("canvas").getContext("2d")!
  const base = fonts[2]
  measure.font = base
  const widths = new Map<string, number>()
  const cw = (ch: string) => {
    let w = widths.get(ch)
    if (w === undefined) {
      w = measure.measureText(ch).width
      widths.set(ch, w)
    }
    return w
  }
  const space = cw(" "), lh = fs * 0.98, e = fs * 1.1
  yield
  const prepared = lib.prepareWithSegments(text.repeat(Math.max(2, Math.ceil(6000 / text.length))), base)
  let cursor: Cursor = { segmentIndex: 0, graphemeIndex: 0 }

  const ch: string[] = [], xs: number[] = [], ys: number[] = [], alpha: number[] = [], tones: number[] = []
  // The phrases: a sentence of Adam's ends at its full stop, a line of God's at its middot. Each letter takes the
  // running count of phrases, and the count is turned into the phrase's text once it closes, so the letters of
  // "add calendar" share one phrase however many rows it spans and however often it comes round.
  const said: number[] = [], phrases: string[] = [], known = new Map<string, number>(), named: number[] = []
  let words = ""
  const close = () => {
    const t = words.replace(/\s+/g, " ").trim()
    words = ""
    let k = known.get(t)
    if (k === undefined) known.set(t, (k = phrases.push(t) - 1))
    named.push(k)
  }
  const top = p.tip.y - tip[1] * p.k, bottom = top + h.h * p.k
  for (let y = top + lh / 2; y < bottom; y += lh) {
    const r = Math.floor(toR(y))
    if (r < 0 || r >= h.h) continue
    yield
    const row = r * h.w
    for (let c = c0; c < c1; c++) {
      if (!grid[row + c]) continue
      const start = c
      while (c < c1 && grid[row + c]) c++
      // The span on the stage, clipped to it: an arm that runs off the edge is cut by the edge, not by the layout.
      const x0 = Math.max(0, toX(start)), x1 = Math.min(W, toX(c))
      const span = x1 - x0
      if (span < fs * 1.6) continue
      let line = lib.layoutNextLine(prepared, cursor, span)
      if (!line) {
        cursor = { segmentIndex: 0, graphemeIndex: 0 }
        line = lib.layoutNextLine(prepared, cursor, span)
      }
      if (!line) continue
      cursor = line.end
      const chars = Array.from(line.text.trimEnd())
      const gaps = chars.filter((s) => s === " ").length
      const used = chars.reduce((s, s2) => s + cw(s2), 0)
      const extra = gaps ? Math.min((span - used) / gaps, space * 1.5) : 0
      let gx = x0
      for (const s of chars) {
        const w = cw(s)
        if (s !== "." && s !== "·") words += s
        if (s !== " ") {
          const cx = gx + w / 2
          const v = at(cx, y) || at(cx - w / 2, y) || at(cx + w / 2, y)
          if (v) {
            const shade = (v - 1) / 15
            const edge = !at(cx, y - e) || !at(cx, y + e) || !at(cx - e, y) || !at(cx + e, y)
            ch.push(s)
            xs.push(cx)
            ys.push(y)
            tones.push(v < cut[0] ? 0 : v < cut[1] ? 1 : v < cut[2] ? 2 : 3)
            // A full stop ends its sentence and is read with it; a middot only stands between two lines.
            said.push(s === "·" ? -1 : named.length)
            // Light in the fresco is faint ink, shadow is full ink; the outline keeps enough to hold its line.
            alpha.push(edge ? Math.max(0.62, 1 - 0.8 * shade ** 1.3) : 1 - 0.8 * shade ** 1.3)
          }
        }
        if (s === "." || s === "·") close()
        gx += w + (s === " " ? extra : 0)
      }
      // A line's end is a space between words, unless it broke at a hyphen.
      if (!words.endsWith("-")) words += " "
    }
  }
  close()

  const n = ch.length
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, far = 1
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, xs[i])
    maxX = Math.max(maxX, xs[i])
    minY = Math.min(minY, ys[i])
    maxY = Math.max(maxY, ys[i])
    far = Math.max(far, Math.hypot(xs[i] - p.tip.x, ys[i] - p.tip.y))
  }
  const pad = fs * 1.5
  const box = n ? { x: Math.floor(minX - pad), y: Math.floor(minY - pad), w: Math.ceil(maxX - minX + pad * 2), h: Math.ceil(maxY - minY + pad * 2) } : { x: 0, y: 0, w: 1, h: 1 }

  // The sheet: every letter each tone uses, set once in its font and ink at the screen's resolution.
  const cells: { x: number; y: number; w: number; h: number }[] = []
  const index = new Map<string, number>()
  const cell = new Uint16Array(n), bold = new Uint16Array(n)
  let cx = 0, cy = 0, rowH = 0, maxW = 0
  const ch2 = Math.ceil(fs * 2 * res)
  const cellOf = (tone: number, c: string) => {
    const key = tone + c
    let s = index.get(key)
    if (s === undefined) {
      measure.font = fonts[tone]
      const w = Math.ceil((measure.measureText(c).width + fs * 0.5) * res)
      if (cx + w > 2048) {
        cx = 0
        cy += rowH
        rowH = 0
      }
      s = cells.length
      cells.push({ x: cx, y: cy, w, h: ch2 })
      index.set(key, s)
      cx += w
      rowH = Math.max(rowH, ch2)
      maxW = Math.max(maxW, cx)
    }
    return s
  }
  for (let i = 0; i < n; i++) {
    cell[i] = cellOf(tones[i], ch[i])
    // The deepest tone is the bold cut a phrase is read in.
    bold[i] = cellOf(0, ch[i])
  }
  yield
  const sheet = document.createElement("canvas")
  sheet.width = Math.max(1, maxW)
  sheet.height = Math.max(1, cy + rowH)
  const g = sheet.getContext("2d")!
  g.textAlign = "center"
  g.textBaseline = "middle"
  let made = 0
  for (const [key, s] of index) {
    if (++made % 48 === 0) yield
    const t = Number(key[0]), c = cells[s]
    g.font = fonts[t]
    g.fillStyle = inks[t]
    g.setTransform(res, 0, 0, res, c.x + c.w / 2, c.y + c.h / 2)
    g.fillText(key.slice(1), 0, 0)
  }

  const hand: Hand = {
    n,
    fs,
    x: Float32Array.from(xs, (v) => v - box.x),
    y: Float32Array.from(ys, (v) => v - box.y),
    alpha: Float32Array.from(alpha),
    cell,
    bold,
    reach: Float32Array.from(xs, (v, i) => Math.min(1, Math.hypot(v - p.tip.x, ys[i] - p.tip.y) / far)),
    phrase: Uint16Array.from(said, (k) => (k < 0 ? 65535 : named[k])),
    phrases,
    box,
    sheet,
    cells,
    res,
  }
  return hand
}

// A settled hand is drawn once into a bitmap; a pointer's frame copies it and sets again only what the pointer changes:
// the letters under the loupe and the phrase being read. The letters of each phrase are listed once per layout.
const rested = new WeakMap<Hand, HTMLCanvasElement>()
const members = new WeakMap<Hand, Map<number, number[]>>()

function letter(ctx: CanvasRenderingContext2D, hand: Hand, i: number, x: number, y: number, k: number, a: number, lit: number) {
  const r = hand.res
  if (a * (1 - lit) > 0.004) {
    const c = hand.cells[hand.cell[i]], w = (c.w / r) * k, h = (c.h / r) * k
    ctx.globalAlpha = a * (1 - lit)
    ctx.drawImage(hand.sheet, c.x, c.y, c.w, c.h, x - w / 2, y - h / 2, w, h)
  }
  if (lit > 0) {
    const b = hand.cells[hand.bold[i]], w = (b.w / r) * k, h = (b.h / r) * k
    ctx.globalAlpha = lit
    ctx.drawImage(hand.sheet, b.x, b.y, b.w, b.h, x - w / 2, y - h / 2, w, h)
  }
}

/**
 * Draws a hand into its canvas. `t` is the overture's clock in ms (Infinity when settled): the letters come up out
 * of the paper from the fingertip back, each over `rise` ms, the last starting at `spread` ms. `touch` is what a
 * pointer is doing to it, once it has settled.
 */
export function drawHand(canvas: HTMLCanvasElement, hand: Hand, t = Infinity, spread = 700, rise = 520, touch?: Touch) {
  const ctx = canvas.getContext("2d")!
  const r = hand.res
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (t !== Infinity) {
    ctx.setTransform(r, 0, 0, r, 0, 0)
    for (let i = 0; i < hand.n; i++) {
      const u = Math.min(1, Math.max(0, (t - hand.reach[i] * spread) / rise))
      if (u <= 0) continue
      const o = 1 - (1 - u) ** 3
      letter(ctx, hand, i, hand.x[i], hand.y[i] + (1 - o) * 4, 1, hand.alpha[i] * o, 0)
    }
    ctx.globalAlpha = 1
    return
  }

  let rest = rested.get(hand)
  if (!rest) {
    rest = document.createElement("canvas")
    rest.width = canvas.width
    rest.height = canvas.height
    const g = rest.getContext("2d")!
    g.setTransform(r, 0, 0, r, 0, 0)
    for (let i = 0; i < hand.n; i++) letter(g, hand, i, hand.x[i], hand.y[i], 1, hand.alpha[i], 0)
    rested.set(hand, rest)
  }
  const T = touch, lens = !!T && T.s > 0, R = T?.r ?? 0
  // The rest of the hand, stepped back while a phrase is read, with a hole where the loupe is.
  ctx.globalAlpha = T ? 1 - 0.4 * T.dim : 1
  if (lens) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, canvas.width, canvas.height)
    ctx.arc(T.x * r, T.y * r, R * r, 0, Math.PI * 2)
    ctx.clip("evenodd")
  }
  ctx.drawImage(rest, 0, 0)
  if (lens) ctx.restore()
  if (!T || (!lens && !T.litA && !T.wasA)) {
    ctx.globalAlpha = 1
    return
  }
  ctx.setTransform(r, 0, 0, r, 0, 0)
  const litOf = (i: number) => {
    const g = hand.phrase[i]
    return g === T.lit ? T.litA : g === T.was ? T.wasA : 0
  }

  if (lens) {
    // The loupe: a letter at distance u (0 at the centre, 1 at the rim) is carried out to u(1 + m(1 - u)^2), so the
    // centre is magnified by 1 + m and the rim meets the page unmoved. Each letter is set at the smaller of the
    // lens's two stretches there, round and outward, so swollen letters never run into their neighbours. Letters
    // just outside the rim are set too, unmoved, for the part of them the hole cut away.
    ctx.save()
    ctx.beginPath()
    ctx.arc(T.x, T.y, R, 0, Math.PI * 2)
    ctx.clip()
    const out = R + hand.fs * 2, m = T.grow * T.s
    for (let i = 0; i < hand.n; i++) {
      const ox = hand.x[i] - T.x, oy = hand.y[i] - T.y
      if (ox > out || ox < -out || oy > out || oy < -out) continue
      const d2 = ox * ox + oy * oy
      if (d2 > out * out) continue
      const lit = litOf(i)
      let a = hand.alpha[i] * (1 - 0.4 * T.dim * (1 - lit)), x = hand.x[i], y = hand.y[i], k = 1
      if (d2 < R * R) {
        const u = Math.sqrt(d2) / R, f = 1 - u, e = f * f * (3 - 2 * f) * T.s
        const round = 1 + m * f * f, outward = 1 + m * f * (1 - 3 * u)
        x = T.x + ox * round
        y = T.y + oy * round
        k = Math.min(round, outward)
        a += (1 - a) * 0.7 * e
      }
      letter(ctx, hand, i, x, y, k, a, lit)
    }
    ctx.restore()
  }

  // The phrase being read, and the one letting go, in the bold cut over the rest; under the loupe it is set above.
  let lists = members.get(hand)
  if (!lists) {
    lists = new Map()
    for (let i = 0; i < hand.n; i++) {
      const g = hand.phrase[i]
      const list = lists.get(g)
      if (list) list.push(i)
      else lists.set(g, [i])
    }
    members.set(hand, lists)
  }
  for (const [g, A] of [[T.lit, T.litA], [T.was, T.wasA]]) {
    if (g < 0 || A <= 0) continue
    for (const i of lists.get(g) ?? []) {
      const ox = hand.x[i] - T.x, oy = hand.y[i] - T.y
      if (lens && ox * ox + oy * oy < R * R) continue
      letter(ctx, hand, i, hand.x[i], hand.y[i], 1, 0, A)
    }
  }
  ctx.globalAlpha = 1
}
