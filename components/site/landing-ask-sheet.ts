import { advances, alongPath, fillShape, measure } from "@/components/site/type-shapes"

// The page someone asks for, sketched in their own words. A request ("a pricing page") is matched to one of eight
// kinds of page by its words, and each kind lays out its own wireframe without a single box: a large heading set in
// their words, columns of their words in fine italic, a picture made of their words (denser is darker, the way an
// engraving shades), a button that is their word between parentheses, and the page's own structure named in small
// roman labels, as Spectra's metadata names its parts ("h1", "col 2/3", "fig. 1"). Everything here is pure: given the
// sheet's size, the faces and the words, it returns marks (lines, letters, hairlines) for the canvas to draw. It runs
// once per keystroke and once per resize or retune, never per frame.

type Lib = typeof import("@chenglou/pretext")
type Prepared = ReturnType<Lib["prepareWithSegments"]>
type Cursor = { segmentIndex: number; graphemeIndex: number }

export type Kind = "page" | "pricing" | "form" | "dashboard" | "list" | "article" | "empty" | "profile"
export type Tone = "ink" | "graphite" | "pencil" | "rule"
/** A set line: its text at the left of its baseline, spread by word space `ws` (or, in a picture, letter space `sp`). `at`
 * is when the scroll brings it in, 0 to 1. */
export type Line = { k: string; t: string; x: number; y: number; ws: number; sp?: number; f: string; tone: Tone; at: number }
/** One letter, drawn on its own so it can travel to its new place when the words change. `s` is its size; `a` its turn. */
export type Glyph = { k: string; g: string; x: number; y: number; s: number; a: number; f: string; tone: Tone; at: number }
export type Rule = { k: string; x1: number; y1: number; x2: number; y2: number; tone: Tone; at: number }
export type Sheet = { kind: Kind; w: number; h: number; lines: Line[]; glyphs: Glyph[]; rules: Rule[] }
export type Base = { lib: Lib; voice: string; expr: string; phone: boolean; w: number; h: number }

export const PLACEHOLDER = "a pricing page"

/** One request for each kind of page, in the order the suggestions offer them. */
export const SUGGESTIONS = ["a pricing page", "a sign-up form", "a dashboard", "a changelog", "an onboarding letter", "a profile page", "a page for when nothing is found", "a landing page"]

// The kinds, tried in order; the first whose words appear wins, and anything else is a page.
const KINDS: [Kind, RegExp][] = [
  ["empty", /\b(empty|nothing|not found|404|error|blank|offline|lost|missing|maintenance|coming soon)\b/],
  ["pricing", /(pric|\bplans?\b|\btiers?\b|subscription|billing|upgrade|membership|\bcost)/],
  ["form", /(sign[ -]?up|sign[ -]?in|log[ -]?in|register|\bform|contact|checkout|booking|\bbook\b|apply|subscribe|waitlist|rsvp|survey|password)/],
  ["dashboard", /(dashboard|analytic|\bstats?\b|metric|report|admin|chart|insight|overview|calendar|tracker|monitor)/],
  ["profile", /(profile|portfolio|\bteam\b|person|\bbio\b|resume|\bcv\b|author|about me|account|member)/],
  ["article", /(article|blog|\bpost\b|letter|essay|\bdocs?\b|documentation|guide|story|onboarding|readme|newsletter|journal|recipe|manifesto)/],
  ["list", /(\blist|table|changelog|\blog\b|inbox|feed|search|results|archive|index|directory|settings|menu|history|orders|catalog|library|releases)/],
]

export function kindOf(phrase: string): Kind {
  const p = phrase.toLowerCase()
  for (const [k, re] of KINDS) if (re.test(p)) return k
  return "page"
}

const STOP = new Set(["a", "an", "the", "for", "of", "with", "me", "my", "to", "in", "and", "when", "is", "that", "on", "at", "by", "it", "its", "our", "your", "some", "one", "this", "where", "which", "what"])
const START: Cursor = { segmentIndex: 0, graphemeIndex: 0 }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const graphemes = (t: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(t)].map((s) => s.segment)
/** A small steady hash, so the same words always give the same numbers. */
const hash = (s: string) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

class Composer {
  lines: Line[] = []
  glyphs: Glyph[] = []
  rules: Rule[] = []
  preps = new Map<string, Prepared>()
  cur: Cursor = START
  stream: string
  /** The words worth naming: each word that isn't a small one, then the runs of two, then the whole request. */
  bits: string[]
  /** The longest of those words: the brand, the button. */
  key: string
  letters: number
  ph: boolean
  L: number; R: number; T: number; B: number; CW: number; CH: number; g: number
  /** Fine text: size and line height. Labels: size. */
  fs: number; lh: number; ls: number

  constructor(public b: Base, public phrase: string) {
    const { w, h, phone } = b
    this.ph = phone
    const m = phone ? w * 0.07 : w * 0.06
    this.L = m; this.R = w - m; this.T = phone ? h * 0.05 : h * 0.07; this.B = h - (phone ? h * 0.045 : h * 0.065)
    this.CW = this.R - this.L; this.CH = this.B - this.T
    this.g = phone ? 10 : w * 0.026
    this.fs = phone ? 5 : 6.4; this.lh = phone ? 6.6 : 8.4; this.ls = phone ? 6 : 7.5
    this.stream = Array(Math.ceil(700 / (phrase.length + 1)) + 1).fill(phrase).join(" ")
    const words = phrase.split(" ").filter(Boolean)
    const big = words.filter((x) => !STOP.has(x.toLowerCase()))
    const runs = words.slice(0, -1).map((x, i) => `${x} ${words[i + 1]}`).filter((r) => r !== phrase)
    this.bits = [...new Set([...(big.length ? big : words), ...runs, phrase])]
    this.key = (big.length ? big : words).reduce((a, x) => (x.length > a.length ? x : a), "")
    this.letters = phrase.replace(/\s/g, "").length
  }

  it(s: number, wt = 400) { return `italic ${wt} ${s}px ${this.b.expr}` }
  ro(s: number, wt = 400) { return `${wt} ${s}px ${this.b.voice}` }
  prep(font: string) {
    let p = this.preps.get(font)
    if (!p) this.preps.set(font, (p = this.b.lib.prepareWithSegments(this.stream, font)))
    return p
  }

  /** A line of text whose baseline is at y; spread to `fit` by its word spaces when fit is given and not too far. */
  line(k: string, t: string, x: number, y: number, f: string, tone: Tone, at: number, fit = 0) {
    let ws = 0
    if (fit) {
      const nat = measure(f, t), gaps = (t.match(/ /g) || []).length
      if (gaps && fit > nat && (fit - nat) / gaps < nat / Math.max(1, t.length) * 3) ws = (fit - nat) / gaps
    }
    this.lines.push({ k, t, x, y, ws, f, tone, at })
  }
  /** The page's own words for its structure: small, roman, pencil. */
  label(k: string, t: string, x: number, y: number, o: { right?: boolean; at?: number; tone?: Tone } = {}) {
    const f = this.ro(this.ls), w = o.right ? measure(f, t) : 0
    this.line(`lab:${k}`, t, x - w, y, f, o.tone ?? "pencil", o.at ?? 0)
  }
  rule(k: string, x1: number, y1: number, x2: number, y2: number, tone: Tone = "rule", at = 0) {
    this.rules.push({ k: `rule:${k}`, x1, y1, x2, y2, tone, at })
  }
  /** Words set letter by letter, so each letter can find its new place; a letter is known by its block, itself and its count. */
  word(k: string, t: string, x: number, y: number, s: number, o: { tone?: Tone; wt?: number; at?: number; roman?: boolean } = {}) {
    const f = o.roman ? this.ro(s, o.wt ?? 400) : this.it(s, o.wt ?? 400), seen = new Map<string, number>()
    let pre = ""
    for (const g of graphemes(t)) {
      const n = seen.get(g) ?? 0
      seen.set(g, n + 1)
      if (g !== " ") this.glyphs.push({ k: `${k}:${g}:${n}`, g, x: x + measure(f, pre), y, s, a: 0, f, tone: o.tone ?? "ink", at: o.at ?? 0.1 })
      pre += g
    }
    return measure(f, t)
  }
  /** The largest italic size at which `t` fits `w`, between lo and hi. */
  fit(t: string, w: number, hi: number, lo: number, wt = 400) {
    return clamp(w / Math.max(1, measure(this.it(100, wt), t) / 100), lo, hi)
  }
  /** The heading: the whole request, as large as `lines` lines of `w` allow, broken by pretext. Returns its foot. */
  head(k: string, x: number, y: number, w: number, o: { max: number; min: number; lines: number; center?: boolean; tone?: Tone; at?: number }) {
    const { lib } = this.b
    let s = this.fit(this.phrase, w * o.lines * 0.86, o.max, o.min)
    let rows: { t: string; w: number }[] = []
    for (let round = 0; round < 8; round++) {
      const f = this.it(s), P = lib.prepareWithSegments(this.phrase, f)
      rows = []
      let cur = START
      for (let line = lib.layoutNextLine(P, cur, w); line; line = lib.layoutNextLine(P, cur, w)) {
        rows.push({ t: line.text.trim(), w: line.width })
        cur = line.end
      }
      if (rows.length <= o.lines || s <= o.min) break
      s = Math.max(o.min, s * 0.9)
    }
    const lh = s * 0.98, seen = new Map<string, number>(), f = this.it(s)
    rows.forEach((r, j) => {
      const lx = o.center ? x + (w - measure(f, r.t)) / 2 : x
      let pre = ""
      for (const g of graphemes(r.t)) {
        const n = seen.get(g) ?? 0
        seen.set(g, n + 1)
        if (g !== " ") this.glyphs.push({ k: `${k}:${g}:${n}`, g, x: lx + measure(f, pre), y: y + s * 0.8 + j * lh, s, a: 0, f, tone: o.tone ?? "ink", at: o.at ?? 0.06 })
        pre += g
      }
    })
    return y + s * 0.8 + (rows.length - 1) * lh + s * 0.22
  }
  /** Fine italic text poured into a column, carrying on from wherever the last column stopped. Returns lines set. */
  flow(k: string, x: number, y: number, w: number, h: number, o: { fs?: number; lh?: number; tone?: Tone; at?: number; spread?: number; widths?: number[]; max?: number; wt?: number; ragged?: boolean } = {}) {
    const { lib } = this.b
    const fs = o.fs ?? this.fs, lh = o.lh ?? this.lh, f = this.it(fs, o.wt ?? 500), P = this.prep(f)
    const rows = Math.min(Math.floor(h / lh), o.max ?? 999), at = o.at ?? 0.3, spread = o.spread ?? 0.4
    let n = 0
    for (let i = 0; i < rows; i++) {
      const lw = w * (o.widths ? o.widths[i % o.widths.length] : 1)
      let line = lib.layoutNextLine(P, this.cur, lw)
      if (!line) { this.cur = START; line = lib.layoutNextLine(P, this.cur, lw) }
      if (!line) break
      this.cur = line.end
      const t = line.text.trim()
      if (!t) continue
      this.line(`${k}:${i}`, t, x, y + i * lh + lh * 0.78, f, o.tone ?? "graphite", at + (spread * i) / Math.max(1, rows), o.ragged || i === rows - 1 ? 0 : lw)
      n++
    }
    return n
  }
  /** Columns of fine text, each named and topped by a hairline, from y down to the sheet's foot. */
  cols(k: string, n: number, x: number, w: number, y: number, at = 0.3) {
    const cw = (w - (n - 1) * this.g) / n, h = this.B - y - 6
    if (h < this.lh * 2) return
    for (let i = 0; i < n; i++) {
      const cx = x + i * (cw + this.g)
      this.label(`${k}${i}`, `col ${i + 1}/${n}`, cx, y - 5)
      this.rule(`${k}${i}`, cx, y, cx + cw, y)
      this.flow(`${k}${i}`, cx, y + 4, cw, h, { at: at + i * 0.08, spread: 0.3 })
    }
  }
  /** A button: the word between parentheses, the parentheses the page's, the word theirs. Returns its width. */
  button(k: string, t: string, x: number, y: number, s: number, o: { tone?: Tone; at?: number; center?: boolean } = {}) {
    const ro = this.ro(s), it = this.it(s * 1.12), gap = s * 0.42
    const w = measure(ro, "(") + gap + measure(it, t) + gap + measure(ro, ")")
    const x0 = o.center ? x - w / 2 : x, at = o.at ?? 0.82
    let cx = x0 + this.word(`${k}(`, "(", x0, y, s, { roman: true, tone: o.tone, at })
    cx += gap
    cx += this.word(`${k}w`, t, cx, y, s * 1.12, { tone: o.tone, at, wt: 500 })
    this.word(`${k})`, ")", cx + gap, y, s, { roman: true, tone: o.tone, at })
    return w
  }
  /** A picture set in their words, shaded by density alone: the more lines to the inch, the darker. */
  fig(k: string, kind: "land" | "ring" | "donut" | "portrait", x: number, y: number, w: number, h: number, at = 0.4, share = 0.62) {
    const { lib } = this.b
    const ph = this.ph
    const part = (name: string, draw: (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => void, size: number, lead: number, tone: Tone, wt: number, at0: number) => {
      // Never under 4 px, however fine the shading asks to be.
      const fs = Math.max(4, size), lh = Math.max(fs * 1.02, lead), f = this.it(fs, wt)
      const got = fillShape(lib, w, h, draw, this.stream, f, fs, lh, { res: 1, prepared: this.prep(f), min: 2.2 })
      got.forEach((l, i) => {
        // Each line fills its band to the shape's edge: by its word spaces when they stay word spaces, and otherwise by
        // spacing its letters a hair apart, so a short band never shows one word, a hole and another.
        let t = l.text.trim()
        // Where the repeated words run out, the line stops short; it carries on into the request again instead.
        const words = this.phrase.split(" ")
        for (let j = words.lastIndexOf(t.slice(t.lastIndexOf(" ") + 1)) + 1, n = 0; l.fit - measure(f, t) > fs * 2 && n < 40; j++, n++) {
          const more = `${t} ${words[j % words.length]}`
          if (measure(f, more) > l.w) break
          t = more
        }
        const nat = measure(f, t), gaps = (t.match(/ /g) || []).length, slack = Math.max(0, l.w - nat)
        const even = gaps > 0 && slack / gaps < fs * 1.2
        this.lines.push({ k: `${k}:${name}:${i}`, t, x: x + l.x, y: y + l.y + lh * 0.78, ws: even ? slack / gaps : 0, sp: !even && t.length > 1 ? Math.min(fs * 0.3, slack / (t.length - 1)) : 0, f, tone, at: at0 + (0.3 * i) / Math.max(1, got.length) })
      })
    }
    const fine = ph ? 4.2 : 4.8
    if (kind === "land") {
      // A sun over a hill: the sky sparse in pencil, the sun dense in ink, the hill close-set in graphite.
      const sx = w * 0.68, sy = h * 0.36, r = Math.min(w, h) * 0.2, hill = (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
        c.beginPath(); c.moveTo(0, h * 0.8); c.bezierCurveTo(w * 0.3, h * 0.58, w * 0.55, h * 0.66, w, h * 0.74); c.lineTo(w, h); c.lineTo(0, h); c.closePath()
      }
      part("sky", (c) => {
        c.fillRect(0, 0, w, h)
        c.globalCompositeOperation = "destination-out"
        c.beginPath(); c.arc(sx, sy, r + fine * 1.6, 0, Math.PI * 2); c.fill()
        hill(c); c.fill()
      }, fine, fine * 2.3, "pencil", 400, at)
      part("sun", (c) => { c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill() }, fine * 0.9, fine * 1.02, "ink", 600, at + 0.1)
      part("hill", (c) => { hill(c); c.fill() }, fine, fine * 1.12, "graphite", 500, at + 0.2)
    } else if (kind === "ring" || kind === "donut") {
      // The zero: a ring of close-set words round an empty middle. As a chart, a share of it dense, the rest sparse.
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, r = R * (kind === "ring" ? 0.64 : 0.56)
      const arc = (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, a0: number, a1: number) => {
        c.beginPath(); c.arc(cx, cy, R, a0, a1); c.arc(cx, cy, r, a1, a0, true); c.closePath(); c.fill()
      }
      const top = -Math.PI / 2, cut = top + Math.PI * 2 * (kind === "ring" ? 1 : share)
      part("on", (c) => arc(c, top, cut), fine * 0.95, fine * 1.04, "ink", 600, at)
      if (kind === "donut") part("off", (c) => arc(c, cut, top + Math.PI * 2), fine, fine * 2.2, "pencil", 400, at + 0.15)
    } else {
      // A portrait as a wireframe draws it: a head and shoulders, dense, in a sparse disc.
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2
      const body = (c: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) => {
        c.beginPath(); c.arc(cx, cy - R * 0.2, R * 0.34, 0, Math.PI * 2); c.fill()
        c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip()
        c.beginPath(); c.ellipse(cx, cy + R * 0.78, R * 0.68, R * 0.5, 0, 0, Math.PI * 2); c.fill(); c.restore()
      }
      part("bg", (c) => {
        c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill()
        c.globalCompositeOperation = "destination-out"
        c.save(); c.translate(cx, cy); c.scale(1.08, 1.08); c.translate(-cx, -cy); body(c); c.restore()
      }, fine, fine * 2.3, "pencil", 400, at)
      part("body", body, fine * 0.95, fine * 1.04, "ink", 600, at + 0.12)
    }
  }
  /** A small row of links along the top, under the request's own name. Returns the hairline's height. */
  nav() {
    const y = this.T, s = this.ph ? 7 : 9
    this.word("brand", this.key, this.L, y + s * 0.9, s, { wt: 600, at: 0.02 })
    const items = this.bits.slice(0, this.ph ? 2 : 3).reverse(), f = this.it(this.ph ? 5.5 : 7, 500)
    let x = this.R
    items.forEach((t, i) => {
      x -= measure(f, t)
      this.line(`nav:${i}`, t, x, y + s * 0.9, f, "graphite", 0.02)
      x -= this.ph ? 10 : 18
    })
    this.label("nav", "nav", this.L, y - 4)
    this.rule("nav", this.L, y + s * 1.5, this.R, y + s * 1.5)
    return y + s * 1.5
  }
  /** Numbers drawn from the words themselves: the same request always counts the same. */
  num(i: number) {
    const v = hash(`${this.bits[i % this.bits.length]}${i}`)
    if (i % 3 === 0) return (v % 9000 + 100).toLocaleString("en")
    if (i % 3 === 1) return `${(v % 900) / 10 + 1}`.replace(/(\.\d).*/, "$1")
    return `${(v % 90) + 8}%`
  }
}

// Each kind of page, as a wireframe. Sizes are fractions of the sheet, so a phone's smaller sheet is composed on its
// own terms: fewer columns, larger type in proportion, nothing under 4 px.
const LAYOUTS: Record<Kind, (c: Composer) => void> = {
  page(c) {
    const top = c.nav() + (c.ph ? 22 : c.CH * 0.11)
    if (!c.ph) {
      c.label("h1", "h1", c.L, top - 6)
      const hb = c.head("head", c.L, top, c.CW * 0.54, { max: 64, min: 22, lines: 3 })
      c.button("btn", c.key, c.L, hb + 26, 12)
      const fx = c.L + c.CW * 0.62, fw = c.CW * 0.38, fh = c.CH * 0.44
      c.fig("fig", "land", fx, top, fw, fh)
      c.label("fig", "fig. 1", fx, top + fh + 12)
      c.cols("col", 3, c.L, c.CW, Math.max(hb + 64, top + fh + 40))
    } else {
      c.label("h1", "h1", c.L, top - 5)
      const hb = c.head("head", c.L, top, c.CW, { max: 36, min: 15, lines: 3 })
      c.button("btn", c.key, c.L, hb + 16, 8)
      const fy = hb + 34, fh = c.CH * 0.26
      c.fig("fig", "land", c.L, fy, c.CW, fh)
      c.label("fig", "fig. 1", c.L, fy + fh + 9)
      c.cols("col", 2, c.L, c.CW, fy + fh + 26)
    }
  },
  pricing(c) {
    const top = c.nav() + (c.ph ? 18 : c.CH * 0.08)
    c.label("h1", "h1", c.L, top - 5)
    const hb = c.head("head", c.L, top, c.ph ? c.CW : c.CW * 0.6, { max: c.ph ? 28 : 46, min: 13, lines: 2 })
    if (!c.ph) c.flow("intro", c.L + c.CW * 0.68, top + 2, c.CW * 0.32, c.lh * 5, { max: 5, at: 0.2 })
    const ty = hb + (c.ph ? 22 : 38), n = 3, cw = (c.CW - (n - 1) * c.g) / n
    const prices = [c.letters, c.letters * 3 + 2, c.letters * 7 + 4].map(String)
    for (let i = 0; i < n; i++) {
      const x = c.L + i * (cw + c.g), mid = i === 1, tone: Tone = mid ? "ink" : "graphite"
      c.label(`tier${i}`, `tier ${i + 1}/${n}`, x, ty - 5)
      c.rule(`tier${i}`, x, ty, x + cw, ty, mid ? "pencil" : "rule")
      const name = c.bits[i % c.bits.length], ns = Math.min(c.ph ? 9 : 15, c.fit(name, cw * 0.95, 99, 4))
      c.word(`tname${i}`, name, x, ty + ns * 1.5, ns, { tone, wt: mid ? 600 : 400, at: 0.2 })
      const py = ty + ns * 1.5 + (c.ph ? 24 : 44), ps = c.ph ? 21 : 40
      const pw = c.word(`price${i}`, prices[i], x, py, ps, { tone, at: 0.3 })
      c.label(`mo${i}`, "/ mo", x + pw + 4, py)
      const fy = py + (c.ph ? 10 : 16), by = c.B - (c.ph ? 2 : 4)
      c.flow(`feat${i}`, x, fy, cw, by - fy - (c.ph ? 16 : 26), { widths: [0.94, 0.7, 0.86, 0.58, 0.8], ragged: true, at: 0.42 + i * 0.06, spread: 0.3 })
      c.button(`btn${i}`, c.key, x, by, c.ph ? 6.5 : 10, { tone })
    }
  },
  form(c) {
    const top = c.nav() + (c.ph ? 18 : c.CH * 0.1)
    c.label("h1", "h1", c.L, top - 5)
    const lw = c.ph ? c.CW : c.CW * 0.4
    const hb = c.head("head", c.L, top, lw, { max: c.ph ? 30 : 48, min: 14, lines: 3 })
    const intro = c.ph ? 3 : 6
    c.flow("intro", c.L, hb + 10, lw, c.lh * intro, { max: intro, at: 0.2 })
    let fy = hb + 10 + intro * c.lh + (c.ph ? 22 : 30)
    const fx = c.ph ? c.L : c.L + c.CW * 0.5, fw = c.ph ? c.CW : c.CW * 0.5
    if (!c.ph) {
      const room = c.B - fy
      if (room > 70) { c.fig("fig", "land", c.L, fy, lw * 0.82, room - 14); c.label("fig", "fig. 1", c.L, c.B + 2) }
      fy = top + 4
    }
    const n = c.ph ? 3 : 4, step = c.ph ? 38 : (c.CH * 0.6) / n
    for (let i = 0; i < n; i++) {
      const y = fy + i * step
      c.label(`f${i}`, `field ${i + 1}/${n}`, fx + fw, y, { right: true })
      c.word(`fw${i}`, c.bits[i % c.bits.length], fx, y + (c.ph ? 2 : 4), c.ph ? 8 : 11, { tone: "graphite", wt: 500, at: 0.3 + i * 0.08 })
      c.rule(`f${i}`, fx, y + step * 0.5, fx + fw, y + step * 0.5, "pencil")
    }
    const by = fy + n * step + (c.ph ? 8 : 14)
    c.button("btn", c.key, fx, by, c.ph ? 9 : 13)
    c.flow("hint", fx, by + (c.ph ? 10 : 16), fw * 0.7, c.lh * 2, { max: 2, tone: "pencil", at: 0.86, ragged: true })
  },
  dashboard(c) {
    const top = c.nav() + (c.ph ? 16 : c.CH * 0.07)
    c.label("h1", "h1", c.L, top - 5)
    const hb = c.head("head", c.L, top, c.ph ? c.CW : c.CW * 0.5, { max: c.ph ? 24 : 36, min: 12, lines: 2 })
    const cols = c.ph ? 2 : 3, rows = 2, gw = c.ph ? c.CW : c.CW * 0.62, ch = c.ph ? c.CH * 0.13 : c.CH * 0.19, gy = hb + (c.ph ? 16 : 24)
    const cap = c.it(c.ph ? 5.5 : 7, 500)
    for (let r = 0; r <= rows; r++) c.rule(`grid${r}`, c.L, gy + r * ch, c.L + gw, gy + r * ch, r === 0 ? "pencil" : "rule")
    for (let i = 0; i < rows * cols; i++) {
      const x = c.L + (i % cols) * (gw / cols), y = gy + Math.floor(i / cols) * ch
      c.label(`n${i}`, `n.${i + 1}`, x, y + (c.ph ? 9 : 12))
      c.word(`num${i}`, c.num(i), x, y + ch * 0.66, c.ph ? 19 : 30, { at: 0.2 + i * 0.05 })
      c.line(`cap${i}`, c.bits[i % c.bits.length], x, y + ch * 0.88, cap, "graphite", 0.25 + i * 0.05)
    }
    if (!c.ph) {
      const d = Math.min(c.CW * 0.28, ch * 2 - 8), dx = c.L + c.CW - d
      c.fig("fig", "donut", dx, gy + 4, d, d, 0.3, ((hash(c.phrase) % 50) + 30) / 100)
      c.label("fig", "fig. 1", dx, gy + d + 16)
    }
    // A chart line set in their words: the request runs along it, each letter turned to the line.
    const y0 = gy + rows * ch + (c.ph ? 26 : 34), y1 = c.B - (c.ph ? 12 : 14), hgt = y1 - y0
    if (hgt < 24) return
    c.label("chart", "fig. 2", c.L, y0 - 8)
    c.rule("axis", c.L, y1, c.R, y1, "pencil")
    const ticks = c.ph ? 6 : 12
    for (let i = 0; i < ticks; i++) c.label(`t${i}`, String(i + 1).padStart(2, "0"), c.L + (i * c.CW) / (ticks - 1) - (i === ticks - 1 ? c.ls : 0), y1 + c.ls + 3)
    const seed = hash(c.phrase), pts: number[] = []
    for (let i = 0; i <= 64; i++) {
      const u = i / 64, v = 0.5 + 0.22 * Math.sin(u * 6.3 + (seed % 7)) + 0.14 * Math.sin(u * 13 + (seed % 11)) + 0.08 * Math.sin(u * 29 + (seed % 5))
      pts.push(c.L + u * c.CW, y0 + (1 - clamp(v, 0.04, 0.98)) * hgt)
    }
    const s = c.ph ? 6 : 8.5, f = c.it(s, 500), seen = new Map<string, number>()
    alongPath(pts, advances(f, c.stream), 0, s * 0.04).forEach((q, i, all) => {
      const n = seen.get(q.g) ?? 0
      seen.set(q.g, n + 1)
      if (q.g === " ") return
      // alongPath centres each letter on the line; we set letters from their baseline's start.
      const cs = Math.cos(q.a), sn = Math.sin(q.a)
      c.glyphs.push({ k: `line:${q.g}:${n}`, g: q.g, x: q.x - cs * q.w / 2 - sn * s * 0.32, y: q.y - sn * q.w / 2 + cs * s * 0.32, s, a: q.a, f, tone: "ink", at: 0.5 + (0.4 * i) / all.length })
    })
  },
  list(c) {
    const top = c.nav() + (c.ph ? 16 : c.CH * 0.08)
    c.label("h1", "h1", c.L, top - 5)
    const hb = c.head("head", c.L, top, c.ph ? c.CW : c.CW * 0.58, { max: c.ph ? 28 : 46, min: 13, lines: 2 })
    if (!c.ph) {
      const sx = c.L + c.CW * 0.68, sw = c.CW * 0.32
      c.label("search", "search", sx, top - 5)
      c.word("q", c.key, sx, top + 16, 10, { tone: "graphite", at: 0.15 })
      c.rule("search", sx, top + 22, sx + sw, top + 22, "pencil")
    }
    const y0 = hb + (c.ph ? 18 : 28), n = c.ph ? 6 : 7, rh = (c.B - y0) / n
    const wx = c.L + (c.ph ? 16 : c.CW * 0.06), tx = c.L + c.CW * (c.ph ? 0.42 : 0.32), tw = c.CW * (c.ph ? 0.58 : 0.5)
    for (let i = 0; i < n; i++) {
      const y = y0 + i * rh, at = 0.2 + i * 0.08, word = c.bits[i % c.bits.length]
      c.rule(`row${i}`, c.L, y, c.R, y)
      c.label(`r${i}`, String(i + 1).padStart(2, "0"), c.L, y + (c.ph ? 10 : 14))
      c.word(`rw${i}`, word, wx, y + (c.ph ? 10 : 14), Math.min(c.ph ? 8 : 11, c.fit(word, tx - wx - 8, 99, 4)), { tone: "ink", wt: 500, at })
      c.flow(`rt${i}`, tx, y + (c.ph ? 4 : 6), tw, c.lh * 2, { max: 2, at, spread: 0.04 })
      if (!c.ph) {
        const v = c.num(i * 3 + 1), f = c.it(8, 500)
        c.line(`rn${i}`, v, c.R - measure(f, v), y + 14, f, "graphite", at)
      }
    }
  },
  article(c) {
    const top = c.nav() + (c.ph ? 20 : c.CH * 0.1)
    const mw = c.ph ? c.CW : c.CW * 0.74, mx = c.ph ? c.L : c.L + (c.CW - mw) / 2
    c.label("h1", "h1", mx, top - 5)
    const hb = c.head("head", mx, top, mw, { max: c.ph ? 34 : 58, min: 15, lines: 2, center: !c.ph })
    const bs = c.ph ? 7 : 9, bf = c.it(bs, 500), bw = measure(bf, c.key)
    c.word("by", c.key, c.ph ? mx : mx + (mw - bw) / 2, hb + (c.ph ? 12 : 16), bs, { tone: "graphite", wt: 500, at: 0.14 })
    const fy = hb + (c.ph ? 24 : 32), fh = c.CH * (c.ph ? 0.22 : 0.24)
    c.fig("fig", "land", mx, fy, mw, fh, 0.3)
    c.label("fig", "fig. 1", mx, fy + fh + 10)
    c.cols("col", c.ph ? 1 : 2, mx, mw, fy + fh + (c.ph ? 24 : 30), 0.4)
  },
  empty(c) {
    const top = c.nav(), cx = c.L + c.CW / 2
    const R = c.ph ? c.CW * 0.36 : Math.min(c.CW, c.CH) * 0.3, cy = top + (c.B - top) * 0.44
    c.fig("fig", "ring", cx - R, cy - R, R * 2, R * 2, 0.15)
    c.label("fig", "fig. 0", cx - R, cy + R + 12)
    const hw = R * 1.08
    c.label("h1", "h1", cx - hw / 2, cy - (c.ph ? 14 : 22))
    c.head("head", cx - hw / 2, cy - (c.ph ? 10 : 16), hw, { max: c.ph ? 13 : 20, min: 6, lines: 2, center: true, at: 0.5 })
    c.button("btn", c.key, cx, cy + R + (c.ph ? 34 : 44), c.ph ? 8 : 12, { center: true })
  },
  profile(c) {
    const top = c.nav() + (c.ph ? 18 : c.CH * 0.09)
    if (!c.ph) {
      const d = c.CH * 0.5
      c.fig("fig", "portrait", c.L, top, d, d, 0.15)
      c.label("fig", "fig. 1", c.L, top + d + 12)
      const hx = c.L + d + c.g * 1.6, hw = c.R - hx
      c.label("h1", "h1", hx, top + d * 0.14 - 5)
      const hb = c.head("head", hx, top + d * 0.14, hw, { max: 54, min: 16, lines: 2 })
      c.flow("bio", hx, hb + 12, hw * 0.62, c.lh * 5, { max: 5, at: 0.3 })
      c.button("btn", c.key, hx, hb + 12 + 5 * c.lh + 24, 12)
      c.cols("col", 3, c.L, c.CW, top + d + 44, 0.45)
    } else {
      const d = c.CW * 0.46, cx = c.L + c.CW / 2
      c.fig("fig", "portrait", cx - d / 2, top, d, d, 0.15)
      c.label("fig", "fig. 1", cx - d / 2, top + d + 8)
      const hb = c.head("head", c.L, top + d + 26, c.CW, { max: 30, min: 13, lines: 2, center: true })
      c.button("btn", c.key, cx, hb + 18, 8, { center: true })
      c.cols("col", 2, c.L, c.CW, hb + 44, 0.45)
    }
  },
}

/** The sheet for a request: its kind, laid out in its words, with the sheet's own notes round its edges. */
export function compose(b: Base, raw: string): Sheet {
  const phrase = raw.replace(/\s+/g, " ").trim() || PLACEHOLDER
  const kind = kindOf(phrase)
  const c = new Composer(b, phrase)
  LAYOUTS[kind](c)
  // Spectra's margins: corner marks, and what the sheet is, counted.
  const { w, h } = b, o = 6, k = c.ph ? 8 : 12
  ;[[0, 0, -1, -1], [w, 0, 1, -1], [0, h, -1, 1], [w, h, 1, 1]].forEach(([x, y, sx, sy], i) => {
    c.rule(`c${i}a`, x + sx * o, y + sy * o, x + sx * o - sx * k, y + sy * o, "pencil")
    c.rule(`c${i}b`, x + sx * o, y + sy * o, x + sx * o, y + sy * o - sy * k, "pencil")
  })
  const words = phrase.split(" ").length
  c.label("m0", `sheet 05 · ${kind}`, 0, -o - 6)
  c.label("m1", `${c.letters} letters · ${words} ${words === 1 ? "word" : "words"}`, w, -o - 6, { right: true })
  c.label("m2", "your words, set as the page", 0, h + o + c.ls + 4)
  c.label("m3", `${c.lines.length + c.glyphs.length} marks, set by pretext`, w, h + o + c.ls + 4, { right: true })
  return { kind, w, h, lines: c.lines, glyphs: c.glyphs, rules: c.rules }
}
