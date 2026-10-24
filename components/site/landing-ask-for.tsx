"use client"

import * as React from "react"

import { compose, PLACEHOLDER, SUGGESTIONS, type Base, type Sheet, type Tone } from "@/components/site/landing-ask-sheet"
import { span, useStage, type Frame } from "@/components/site/stage"
import { Button } from "@/registry/0nlytype/ui/button"
import { Input } from "@/registry/0nlytype/ui/field"

// Ask for it: you finish the sentence "Build me ___ in 0nlyType.", and the page you asked for is sketched beside it in
// your own words, a sheet laid on the table at a slight angle. Each key re-sets the sheet with pretext: the heading's
// letters travel to their new places and the fine text is re-set from the top down, in about a third of a second, and
// then nothing moves. The scroll brings the sheet in, structure first and then your words into it. Under reduced
// motion the sheet is simply there, and each key changes it at once. The copy button hands an assistant a prompt that
// already knows 0nlyType's rules.

const PROMPT = (thing: string) =>
  `Read docs/0nlytype/AGENTS.md, docs/0nlytype/INTENT.md, docs/0nlytype/DESIGN-core.md and the relevant component contracts. Confirm which paths you loaded. Build ${thing} with 0nlyType. Use an installed 0nlyType component as precedent. Run the completion checklist and report evidence.`

const RESET = 340 // ms for a key's re-set to settle
const STAGGER = 0.28 // of that, the most a letter waits for its turn
const RAMP = 26 // px over which the re-set's edge fades between the old sheet and the new
const CONVERT = 2200 // ms for a taken suggestion to pour out of the sentence and become the page

type Pos = { x: number; y: number; s: number }
/** The request's letters as they stand in the blank: each one's offset from the blank's start, and the face they are set in. */
type Source = { el: HTMLInputElement; offs: number[]; chars: string[]; size: number; width: number }
type Held = {
  base: Base | null
  sheet: Sheet | null
  /** The sheet being replaced while a re-set runs, where each of its letters stood, and what didn't change. */
  prev: Sheet | null
  from: Map<string, Pos>
  kept: Set<string>
  gone: Set<string>
  t0: number
  /** How the sheet is changing: a key re-sets it in place; a taken suggestion pours the words out of the blank. */
  mode: "reset" | "convert"
  dur: number
  /** The words of the sheet being replaced, to set it again if the canvas changes size mid-way. */
  was: string
  src: Source | null
  /** For each of the sheet's letters, which letter of the blank it leaves from. */
  pick: number[]
  /** Where the sheet sits on the canvas, and its turn. */
  geo: { cx: number; cy: number; a: number }
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3)
const sig = (m: { k: string; t?: string; x?: number; y?: number; x1?: number; y1?: number; x2?: number }) => `${m.k}|${m.t ?? ""}|${Math.round(m.x ?? m.x1 ?? 0)}|${Math.round(m.y ?? m.y1 ?? 0)}|${Math.round(m.x2 ?? 0)}`

/** The sheet's size on a canvas of w by h: wide and low on a laptop, tall on a phone. */
function geometry(w: number, h: number, phone: boolean) {
  const sw = phone ? w * 0.9 : Math.min(w * 0.9, (h - 88) * 1.56)
  const sh = phone ? Math.min(sw * 1.32, h - 64) : sw / 1.56
  return { sw, sh, cx: w * 0.5, cy: h * 0.5, a: (phone ? -2 : -3.2) * (Math.PI / 180) }
}

/** Paints the sheet: q is how far the scroll has brought it in, t how far a key's re-set has run (1 when settled). */
function paint(ctx: CanvasRenderingContext2D, f: Frame, H: Held, q: number, t: number) {
  const S = H.sheet
  if (!S) return
  const P = t < 1 ? H.prev : null
  const col: Record<Tone, string> = { ink: f.ink.ink, graphite: f.ink.graphite, pencil: f.ink.pencil, rule: f.ink.rule }
  const shown = (at: number) => span(q, at * 0.85, at * 0.85 + 0.15)
  // The re-set runs down the sheet: above its edge the new words, below it the old.
  const edge = P ? -RAMP + (S.h + 2 * RAMP) * ease(t) : Infinity
  const below = (y: number) => Math.min(1, Math.max(0, (edge - y) / RAMP))

  ctx.save()
  ctx.translate(H.geo.cx, H.geo.cy)
  ctx.rotate(H.geo.a)
  ctx.translate(-S.w / 2, -S.h / 2)

  ctx.lineWidth = 1
  const stroke = (r: Sheet["rules"][number], a: number) => {
    if (a <= 0.01) return
    ctx.globalAlpha = a
    ctx.strokeStyle = col[r.tone]
    ctx.beginPath(); ctx.moveTo(r.x1, r.y1); ctx.lineTo(r.x2, r.y2); ctx.stroke()
  }
  for (const r of S.rules) stroke(r, shown(r.at) * (P && !H.kept.has(sig(r)) ? below(r.y1) : 1))
  if (P) for (const r of P.rules) if (H.gone.has(sig(r))) stroke(r, shown(r.at) * (1 - below(r.y1)))

  let font = ""
  const set = (l: Sheet["lines"][number], a: number) => {
    if (a <= 0.01) return
    if (l.f !== font) ctx.font = font = l.f
    ctx.globalAlpha = a
    ctx.fillStyle = col[l.tone]
    if (l.ws) ctx.wordSpacing = `${l.ws}px`
    if (l.sp) ctx.letterSpacing = `${l.sp}px`
    ctx.fillText(l.t, l.x, l.y)
    if (l.ws) ctx.wordSpacing = "0px"
    if (l.sp) ctx.letterSpacing = "0px"
  }
  for (const l of S.lines) set(l, shown(l.at) * (P && !H.kept.has(sig(l)) ? below(l.y) : 1))
  if (P) for (const l of P.lines) if (H.gone.has(sig(l))) set(l, shown(l.at) * (1 - below(l.y)))

  // The letters: each travels from where it stood to where it stands now, a little after the one before it.
  const m = ctx.getTransform(), n = S.glyphs.length
  const glyph = (g: Sheet["glyphs"][number], x: number, y: number, k: number, a: number) => {
    if (a <= 0.01) return
    if (g.f !== font) ctx.font = font = g.f
    ctx.globalAlpha = a
    ctx.fillStyle = col[g.tone]
    if (g.a || k !== 1) {
      ctx.translate(x, y)
      if (g.a) ctx.rotate(g.a)
      if (k !== 1) ctx.scale(k, k)
      ctx.fillText(g.g, 0, 0)
      ctx.setTransform(m)
    } else ctx.fillText(g.g, x, y)
  }
  S.glyphs.forEach((g, i) => {
    const show = shown(g.at)
    if (!P) return glyph(g, g.x, g.y, 1, show)
    const e = ease(Math.min(1, Math.max(0, (t - (STAGGER * i) / Math.max(1, n)) / (1 - STAGGER))))
    const o = H.from.get(g.k)
    if (!o) return glyph(g, g.x, g.y + (1 - e) * g.s * 0.25, 1, show * e)
    glyph(g, o.x + (g.x - o.x) * e, o.y + (g.y - o.y) * e, (o.s + (g.s - o.s) * e) / g.s, show)
  })
  if (P) {
    const here = new Set(S.glyphs.map((g) => g.k)), e = ease(Math.min(1, t / (1 - STAGGER)))
    for (const g of P.glyphs) if (!here.has(g.k)) glyph(g, g.x, g.y, 1, shown(g.at) * (1 - e))
  }
  ctx.restore()
  ctx.globalAlpha = 1
}

/** A small steady number from 0 to 1 for a mark, so a letter always falls and flies the same way. */
const jitter = (k: string) => {
  let h = 2166136261
  for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

/** Gives each letter of the sheet a letter of the blank to leave from: the same letter where the request has it, taken
 * in turn, and otherwise the one at its place in the count. */
function from(S: Sheet, chars: string[]) {
  const at = new Map<string, number[]>(), used = new Map<string, number>()
  chars.forEach((c, j) => { if (c.trim()) at.set(c.toLowerCase(), [...(at.get(c.toLowerCase()) ?? []), j]) })
  return S.glyphs.map((g, i) => {
    const low = g.g.toLowerCase(), hits = at.get(low), n = used.get(low) ?? 0
    used.set(low, n + 1)
    return hits ? hits[n % hits.length] : i % Math.max(1, chars.length)
  })
}

/** Where the blank's letters stand now, in the sheet's own coordinates: the sheet is turned, the blank is not. */
function blank(cv: HTMLCanvasElement, H: Held, S: Sheet) {
  const src = H.src
  if (!src) return null
  const c = cv.getBoundingClientRect(), r = src.el.getBoundingClientRect(), cs = getComputedStyle(src.el)
  const x0 = r.left - c.left + (parseFloat(cs.paddingInlineStart) || 0), y0 = r.bottom - c.top - (parseFloat(cs.paddingBottom) || 0) - src.size * 0.22
  const cos = Math.cos(-H.geo.a), sin = Math.sin(-H.geo.a)
  const local = (x: number, y: number) => {
    const dx = x - H.geo.cx, dy = y - H.geo.cy
    return { x: dx * cos - dy * sin + S.w / 2, y: dx * sin + dy * cos + S.h / 2 }
  }
  return { at: (i: number) => local(x0 + src.offs[i], y0), start: local(x0, y0 + src.size * 0.12), end: local(x0 + src.width, y0 + src.size * 0.12) }
}

/**
 * A taken suggestion becomes the page. The old page's letters drop off the sheet as its lines lift away; two
 * construction lines run from the ends of the blank to the sheet's top corners; then each letter of the request leaves
 * the blank, turns as it flies an arc down to its place and settles to its size, the hairlines are drawn in as by a pen,
 * and the fine text types itself in, top down. t runs 0 to 1 over CONVERT.
 */
function pour(ctx: CanvasRenderingContext2D, f: Frame, cv: HTMLCanvasElement, H: Held, q: number, t: number) {
  const S = H.sheet, P = H.prev
  if (!S) return
  const col: Record<Tone, string> = { ink: f.ink.ink, graphite: f.ink.graphite, pencil: f.ink.pencil, rule: f.ink.rule }
  const shown = (at: number) => span(q, at * 0.85, at * 0.85 + 0.15)
  const B = blank(cv, H, S)

  ctx.save()
  ctx.translate(H.geo.cx, H.geo.cy)
  ctx.rotate(H.geo.a)
  ctx.translate(-S.w / 2, -S.h / 2)
  const m = ctx.getTransform()
  ctx.lineWidth = 1
  let font = ""
  const line = (x1: number, y1: number, x2: number, y2: number, tone: Tone, a: number) => {
    if (a <= 0.01) return
    ctx.globalAlpha = a
    ctx.strokeStyle = col[tone]
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
  }
  const text = (l: Sheet["lines"][number], s: string, a: number) => {
    if (a <= 0.01 || !s) return
    if (l.f !== font) ctx.font = font = l.f
    ctx.globalAlpha = a
    ctx.fillStyle = col[l.tone]
    if (l.ws) ctx.wordSpacing = `${l.ws}px`
    if (l.sp) ctx.letterSpacing = `${l.sp}px`
    ctx.fillText(s, l.x, l.y)
    if (l.ws) ctx.wordSpacing = "0px"
    if (l.sp) ctx.letterSpacing = "0px"
  }
  const glyph = (g: Sheet["glyphs"][number], x: number, y: number, k: number, turn: number, a: number) => {
    if (a <= 0.01) return
    if (g.f !== font) ctx.font = font = g.f
    ctx.globalAlpha = a
    ctx.fillStyle = col[g.tone]
    ctx.translate(x, y)
    if (turn) ctx.rotate(turn)
    if (k !== 1) ctx.scale(k, k)
    ctx.fillText(g.g, 0, 0)
    ctx.setTransform(m)
  }

  // The old page leaves: its hairlines draw back to where they began, its text fades, and its letters drop and tumble.
  if (P) {
    const out = ease(span(t, 0, 0.3)), fall = span(t, 0, 0.36)
    for (const r of P.rules) line(r.x1, r.y1, r.x1 + (r.x2 - r.x1) * (1 - out), r.y1 + (r.y2 - r.y1) * (1 - out), r.tone, shown(r.at) * (1 - out))
    for (const l of P.lines) text(l, l.t, shown(l.at) * (1 - out))
    for (const g of P.glyphs) {
      const j = jitter(g.k)
      glyph(g, g.x + (j - 0.5) * 60 * fall, g.y + fall * fall * (90 + 140 * j), 1, g.a + (j - 0.5) * 2.4 * fall, shown(g.at) * (1 - fall))
    }
  }

  // The construction lines: from the ends of the blank to the sheet's top corners, there while the letters travel.
  if (B) {
    const reach = ease(span(t, 0.04, 0.3)), fade = 1 - span(t, 0.62, 0.95)
    for (const [a, b] of [[B.start, { x: 0, y: 0 }], [B.end, { x: S.w, y: 0 }]] as const)
      line(a.x, a.y, a.x + (b.x - a.x) * reach, a.y + (b.y - a.y) * reach, "pencil", 0.9 * fade)
  }

  // The new page's hairlines, each drawn from its start, in the order the scroll would bring them.
  for (const r of S.rules) {
    const k = ease(span(t, 0.3 + 0.3 * r.at, 0.52 + 0.3 * r.at))
    line(r.x1, r.y1, r.x1 + (r.x2 - r.x1) * k, r.y1 + (r.y2 - r.y1) * k, r.tone, shown(r.at) * Math.min(1, k * 3))
  }
  // Its fine text, typed in letter by letter, top down.
  for (const l of S.lines) {
    const k = span(t, 0.46 + 0.36 * l.at, 0.64 + 0.36 * l.at)
    text(l, k >= 1 ? l.t : l.t.slice(0, Math.ceil(l.t.length * k)), shown(l.at))
  }
  // Its letters, out of the blank (each from the letter `from` gave it).
  const n = S.glyphs.length, src = H.src
  S.glyphs.forEach((g, i) => {
    const show = shown(g.at)
    const k0 = 0.14 + 0.42 * (i / Math.max(1, n)), e = ease(span(t, k0, k0 + 0.4))
    if (!B || !src || e >= 1) return glyph(g, g.x, g.y, 1, g.a, show)
    if (e <= 0) return
    const from = B.at(H.pick[i] ?? 0)
    // A quadratic arc: its bend leans to one side or the other, by the letter.
    const j = jitter(g.k), mx = (from.x + g.x) / 2 + (j - 0.5) * Math.abs(g.y - from.y) * 0.9, my = Math.min(from.y, g.y) - 30 * j
    const u = 1 - e, x = u * u * from.x + 2 * u * e * mx + e * e * g.x, y = u * u * from.y + 2 * u * e * my + e * e * g.y
    const k = src.size / g.s + (1 - src.size / g.s) * e
    glyph(g, x, y, k, g.a * e + u * (-H.geo.a + (j - 0.5) * 3), show * Math.min(1, e * 6))
  })
  ctx.restore()
  ctx.globalAlpha = 1
}

/** Ask for it: you write what you want in the blank, in your italic, and copy a prompt that already knows the rules. */
export function AskFor() {
  const [what, setWhat] = React.useState("")
  const [copied, setCopied] = React.useState(false)
  const timer = React.useRef(0)
  React.useEffect(() => () => clearTimeout(timer.current), [])
  const thing = what.trim() || PLACEHOLDER
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT(thing))
    } catch {
      return
    }
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  const host = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)
  const want = React.useRef(thing)
  // A taken suggestion pours out of the blank; a key re-sets in place. `shot` counts the takes, so taking the same one again plays again.
  const [shot, setShot] = React.useState(0)
  const pouring = React.useRef(false)
  const held = React.useRef<Held>({ base: null, sheet: null, prev: null, from: new Map(), kept: new Set(), gone: new Set(), t0: -1e9, mode: "reset", dur: RESET, was: "", src: null, pick: [], geo: { cx: 0, cy: 0, a: 0 } })

  const canvas = useStage<Held>(host, {
    // A new size, face or ink: the sheet is set again for it. The canvas covers the sentence too, so the letters can leave
    // the blank; the sheet sits where the sketch's box is. A pour under way carries on in the new size.
    layout(f) {
      const H = held.current, cv = canvas.current, sk = host.current
      const c = cv?.getBoundingClientRect(), r = sk?.getBoundingClientRect()
      const ox = c && r ? r.left - c.left : 0, oy = c && r ? r.top - c.top : 0, sw = r?.width || f.w, sh = r?.height || f.h
      const g = geometry(sw, sh, f.phone)
      H.base = { lib: f.lib, voice: f.ink.voice, expr: f.ink.expression, phone: f.phone, w: g.sw, h: g.sh }
      H.geo = { cx: ox + g.cx, cy: oy + g.cy, a: g.a }
      H.sheet = compose(H.base, want.current)
      const going = H.mode === "convert" && f.now - H.t0 < H.dur
      H.prev = going && H.was ? compose(H.base, H.was) : null
      if (going && H.src) H.pick = from(H.sheet, H.src.chars)
      return H
    },
    draw(f, H) {
      const q = f.still ? 1 : span(f.p, 0.04, 0.34)
      const t = f.still ? 1 : Math.min(1, (f.now - H.t0) / H.dur)
      if (H.mode === "convert" && t < 1 && canvas.current) {
        pour(f.ctx, f, canvas.current, H, q, t)
        return true
      }
      const k = H.prev && H.mode === "reset" ? t : 1
      if (k >= 1) H.prev = null
      // A settled sheet is painted whole on each frame the scroll asks for. That costs about a millisecond; a copy kept
      // on a second canvas was tried and cost more, in stalls whenever it was painted again.
      paint(f.ctx, f, H, q, k)
      return k < 1
    },
  })

  // A key: set the sheet again in the new words, and start the re-set from wherever every letter stands right now.
  // A taken suggestion: read where the blank's letters stand, and pour them into the new page.
  React.useEffect(() => {
    want.current = thing
    const H = held.current
    if (!H.base || !H.sheet) return
    const now = performance.now(), old = H.sheet
    const next = compose(H.base, thing)
    if (pouring.current && input.current) {
      pouring.current = false
      const el = input.current, cs = getComputedStyle(el), size = parseFloat(cs.fontSize)
      const pen = document.createElement("canvas").getContext("2d")!
      pen.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`
      const chars = [...thing]
      const offs = chars.map((_, i) => pen.measureText(chars.slice(0, i).join("")).width)
      H.src = { el, chars, offs, size, width: pen.measureText(thing).width }
      H.mode = "convert"
      H.dur = CONVERT
      H.prev = old
      H.sheet = next
      H.pick = from(next, chars)
      H.t0 = now
      canvas.current?.dispatchEvent(new PointerEvent("pointerleave"))
      return
    }
    const run = H.prev && H.mode === "reset" ? Math.min(1, (now - H.t0) / RESET) : 1
    const from_ = new Map<string, Pos>(), n = old.glyphs.length
    old.glyphs.forEach((g, i) => {
      const o = H.prev && run < 1 ? H.from.get(g.k) : undefined
      if (!o) return from_.set(g.k, { x: g.x, y: g.y, s: g.s })
      const e = ease(Math.min(1, Math.max(0, (run - (STAGGER * i) / Math.max(1, n)) / (1 - STAGGER))))
      from_.set(g.k, { x: o.x + (g.x - o.x) * e, y: o.y + (g.y - o.y) * e, s: o.s + (g.s - o.s) * e })
    })
    const was = new Set([...old.lines, ...old.rules].map(sig)), now_ = new Set([...next.lines, ...next.rules].map(sig))
    H.kept = new Set([...now_].filter((s) => was.has(s)))
    H.gone = new Set([...was].filter((s) => !now_.has(s)))
    H.from = from_
    H.prev = old
    H.sheet = next
    H.mode = "reset"
    H.dur = RESET
    H.t0 = now
    // The stage asks for a frame on a scroll, a pointer, a resize or a retune; a key is none of these, so it is
    // told by a pointer leaving its canvas, which this scene doesn't read.
    canvas.current?.dispatchEvent(new PointerEvent("pointerleave"))
  }, [thing, shot, canvas])
  const take = (s: string) => {
    pouring.current = true
    held.current.was = want.current
    setWhat(s)
    setShot((n) => n + 1)
  }

  return (
    <div className="ask">
      <label className="ask-line">
        Build me{" "}
        <span className="ask-fill">
          <Input ref={input} className="ask-what" value={what} placeholder={PLACEHOLDER} autoComplete="off" spellCheck={false} maxLength={48} onChange={(e) => setWhat(e.target.value)} />
        </span>{" "}
        in 0nlyType.
      </label>
      <p className="ask-picks">
        <span className="ask-picks-name">Or take one:</span>{" "}
        {SUGGESTIONS.map((s, i) => (
          <React.Fragment key={s}>
            <span className="ask-pick-item">
              <button type="button" className="ask-pick" aria-pressed={thing === s} onClick={() => take(s)}>
                {s}
              </button>
              {i < SUGGESTIONS.length - 1 ? <span className="ask-pick-sep"> ·</span> : null}
            </span>{" "}
          </React.Fragment>
        ))}
      </p>
      <div ref={host} className="ask-sketch" />
      <canvas ref={canvas} className="ask-canvas" aria-hidden="true" />
      <div className="ask-foot">
        <Button variant="bracket" onClick={copy}>
          {copied ? "Copied" : "Copy the prompt"}
        </Button>
        <span className="ot-sr" aria-live="polite">
          {copied ? "The prompt is on the clipboard." : ""}
        </span>
      </div>
    </div>
  )
}
