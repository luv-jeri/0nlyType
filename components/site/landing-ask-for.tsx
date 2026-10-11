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

type Pos = { x: number; y: number; s: number }
type Held = {
  base: Base | null
  sheet: Sheet | null
  /** The sheet being replaced while a re-set runs, where each of its letters stood, and what didn't change. */
  prev: Sheet | null
  from: Map<string, Pos>
  kept: Set<string>
  gone: Set<string>
  t0: number
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
  const want = React.useRef(thing)
  const held = React.useRef<Held>({ base: null, sheet: null, prev: null, from: new Map(), kept: new Set(), gone: new Set(), t0: -1e9, geo: { cx: 0, cy: 0, a: 0 } })

  const canvas = useStage<Held>(host, {
    // A new size, face or ink: the sheet is set again from scratch, with no re-set to play.
    layout(f) {
      const H = held.current, g = geometry(f.w, f.h, f.phone)
      H.base = { lib: f.lib, voice: f.ink.voice, expr: f.ink.expression, phone: f.phone, w: g.sw, h: g.sh }
      H.geo = { cx: g.cx, cy: g.cy, a: g.a }
      H.sheet = compose(H.base, want.current)
      H.prev = null
      return H
    },
    draw(f, H) {
      const q = f.still ? 1 : span(f.p, 0.04, 0.34)
      const t = f.still || !H.prev ? 1 : Math.min(1, (f.now - H.t0) / RESET)
      if (t >= 1) H.prev = null
      // A settled sheet is painted whole on each frame the scroll asks for. That costs about a millisecond; a copy kept
      // on a second canvas was tried and cost more, in stalls whenever it was painted again.
      paint(f.ctx, f, H, q, t)
      return t < 1
    },
  })

  // A key: set the sheet again in the new words, and start the re-set from wherever every letter stands right now.
  React.useEffect(() => {
    want.current = thing
    const H = held.current
    if (!H.base || !H.sheet) return
    const now = performance.now(), old = H.sheet
    const run = H.prev ? Math.min(1, (now - H.t0) / RESET) : 1
    const from = new Map<string, Pos>(), n = old.glyphs.length
    old.glyphs.forEach((g, i) => {
      const o = H.prev && run < 1 ? H.from.get(g.k) : undefined
      if (!o) return from.set(g.k, { x: g.x, y: g.y, s: g.s })
      const e = ease(Math.min(1, Math.max(0, (run - (STAGGER * i) / Math.max(1, n)) / (1 - STAGGER))))
      from.set(g.k, { x: o.x + (g.x - o.x) * e, y: o.y + (g.y - o.y) * e, s: o.s + (g.s - o.s) * e })
    })
    const next = compose(H.base, thing)
    const was = new Set([...old.lines, ...old.rules].map(sig)), now_ = new Set([...next.lines, ...next.rules].map(sig))
    H.kept = new Set([...now_].filter((s) => was.has(s)))
    H.gone = new Set([...was].filter((s) => !now_.has(s)))
    H.from = from
    H.prev = old
    H.sheet = next
    H.t0 = now
    // The stage asks for a frame on a scroll, a pointer, a resize or a retune; a key is none of these, so it is
    // told by a pointer leaving its canvas, which this scene doesn't read.
    canvas.current?.dispatchEvent(new PointerEvent("pointerleave"))
  }, [thing, canvas])

  return (
    <div className="ask">
      <label className="ask-line">
        Build me{" "}
        <span className="ask-fill">
          <Input className="ask-what" value={what} placeholder={PLACEHOLDER} autoComplete="off" spellCheck={false} maxLength={48} onChange={(e) => setWhat(e.target.value)} />
        </span>{" "}
        in 0nlyType.
      </label>
      <p className="ask-picks">
        <span className="ask-picks-name">Or take one:</span>{" "}
        {SUGGESTIONS.map((s, i) => (
          <React.Fragment key={s}>
            <span className="ask-pick-item">
              <button type="button" className="ask-pick" aria-pressed={thing === s} onClick={() => setWhat(s)}>
                {s}
              </button>
              {i < SUGGESTIONS.length - 1 ? <span className="ask-pick-sep"> ·</span> : null}
            </span>{" "}
          </React.Fragment>
        ))}
      </p>
      <div ref={host} className="ask-sketch">
        <canvas ref={canvas} className="ask-canvas" aria-hidden="true" />
      </div>
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
