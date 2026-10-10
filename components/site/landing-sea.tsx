"use client"

import * as React from "react"

import { SharePlaces, useShare } from "@/components/site/landing-share"
import { WAVE, type Figure } from "@/lib/site/figures"
import { Button } from "@/registry/0nlytype/ui/button"
import { Field, Input } from "@/registry/0nlytype/ui/field"

// 03, the sea: your line, set in your italic over and over until it draws Hokusai's wave. Each row of the print's
// tone grid (lib/site/figures.ts, precomputed) is filled with your words, at 400 where the sea is foam, 600 in the
// body of the water and 900 where it is darkest; the sky is left empty. Typing re-sets the sea once you pause, as
// a short sweep from left to right. The link it shares carries the line, so whoever opens it finds their sea
// already set, with nothing moving.

const START = "only what matters."
const MAX = 60
const WEIGHTS = [400, 600, 900]

const decode = (f: Figure) => f.rows.map((r) => r.replace(/([a-d])(\d+)/g, (_, t: string, n: string) => String("abcd".indexOf(t)).repeat(Number(n))))
const ROWS = decode(WAVE)

// The crest: the inked cell that reaches furthest right in the top tenth of the print, where the claw of foam
// hangs. The note points at it, so it stays true at every width.
const CREST = (() => {
  let col = 0, row = 0
  ROWS.slice(0, Math.ceil(WAVE.h * 0.1)).forEach((r, i) => {
    const c = r.replace(/0+$/, "").length - 1
    if (c > col) {
      col = c
      row = i
    }
  })
  return { x: (col + 1) / WAVE.w, y: (row + 0.5) / WAVE.h }
})()

/** The first family in a font stack, unquoted: what the credit names. */
const family = (stack: string) => stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "") || "your italic"

export function Sea() {
  const [line, setLine] = React.useState(START)
  const [times, setTimes] = React.useState(0)
  const [face, setFace] = React.useState("Bodoni Moda")
  const said = line.trim() || START
  const wave = React.useRef<SVGSVGElement>(null)
  const draw = React.useRef<(animate: boolean) => void>(() => {})
  const typed = React.useRef(false)
  const share = useShare(`/?sea=${encodeURIComponent(said)}#sea`)

  // Opened from a shared link: the line arrives already set, with nothing moving.
  React.useEffect(() => {
    const shared = new URLSearchParams(location.search).get("sea")?.trim().slice(0, MAX)
    if (!shared) return
    const arrive = window.setTimeout(() => setLine(shared))
    return () => clearTimeout(arrive)
  }, [])

  // The drawing: measured letters along each row's runs of one tone. Written once per line and width, never per frame.
  React.useEffect(() => {
    const svg = wave.current
    if (!svg) return
    const ctx = document.createElement("canvas").getContext("2d")
    const widths = new Map<string, number>()
    let drawnFor = ""
    draw.current = (animate) => {
      const W = Math.round(svg.parentElement?.clientWidth ?? 0)
      if (!W || !ctx) return
      const H = Math.round((W * WAVE.h) / WAVE.w)
      const phone = W < 640
      const fs = phone ? 5.6 : W < 1000 ? 7.2 : 8.6, lead = fs * 0.92, rows = Math.floor(H / lead)
      const stack = getComputedStyle(svg).fontFamily
      const text = `${svg.dataset.line ?? START} `
      const key = `${W}|${stack}|${text}`
      if (key === drawnFor && !animate) return
      drawnFor = key
      setFace(family(stack))
      const width = (ch: string, w: number) => {
        const k = `${stack}${w}${ch}`
        let v = widths.get(k)
        if (v === undefined) {
          ctx.font = `italic ${w} ${fs}px ${stack}`
          v = ctx.measureText(ch).width
          widths.set(k, v)
        }
        return v
      }
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`)
      svg.style.setProperty("--fs", `${fs}px`)
      const frag = document.createDocumentFragment()
      const step = Math.max(1, fs * 0.25), min = fs * 0.9
      let i = 0, chars = 0
      for (let r = 0; r < rows; r++) {
        const row = ROWS[Math.min(WAVE.h - 1, Math.floor(((r + 0.5) / rows) * WAVE.h))]
        const runs: { t: number; a: number; b: number }[] = []
        let run: { t: number; a: number; b: number } | null = null
        for (let x = 0; x < W; x += step) {
          const t = Number(row[Math.min(WAVE.w - 1, Math.floor((x / W) * WAVE.w))])
          if (run && run.t === t) run.b = x + step
          else {
            if (run) runs.push(run)
            run = { t, a: x, b: x + step }
          }
        }
        if (run) runs.push(run)
        // A run shorter than a letter joins its neighbour, so edges stay letter-sized.
        for (let j = 0; j < runs.length; j++) {
          const s = runs[j]
          if (!s.t || s.b - s.a >= min) continue
          const n = runs[j - 1]?.t ? runs[j - 1] : runs[j + 1]?.t ? runs[j + 1] : null
          if (n) {
            n.a = Math.min(n.a, s.a)
            n.b = Math.max(n.b, s.b)
          }
          s.t = 0
        }
        for (const s of runs) {
          const w = Math.min(s.b, W) - s.a
          if (!s.t || w < min) continue
          const weight = WEIGHTS[s.t - 1]
          while (text[i % text.length] === " ") i++
          let used = 0, out = ""
          while (used < w - 0.5) {
            const ch = text[i % text.length]
            i++
            out += ch
            used += width(ch, weight)
          }
          out = out.replace(/\s+$/, "")
          if (!out) continue
          chars += out.length
          const el = document.createElementNS("http://www.w3.org/2000/svg", "text")
          el.setAttribute("x", s.a.toFixed(1))
          el.setAttribute("y", ((r + 0.5) * lead).toFixed(1))
          el.setAttribute("textLength", w.toFixed(1))
          el.setAttribute("lengthAdjust", "spacing")
          el.setAttribute("class", `w${s.t}`)
          el.style.setProperty("--x", ((s.a + w / 2) / W).toFixed(3))
          el.textContent = out
          frag.append(el)
        }
      }
      svg.toggleAttribute("data-live", animate)
      svg.replaceChildren(frag)
      setTimes(Math.round(chars / text.length))
    }

    let raf = 0
    const again = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => draw.current(false))
    }
    const size = new ResizeObserver(again)
    if (svg.parentElement) size.observe(svg.parentElement)
    // The pair changes the italic, and the fonts arriving change every width.
    const pair = new MutationObserver(again)
    pair.observe(document.documentElement, { attributes: true, attributeFilter: ["data-pair"] })
    document.fonts?.ready.then(again)
    return () => {
      cancelAnimationFrame(raf)
      size.disconnect()
      pair.disconnect()
    }
  }, [])

  // A new line re-sets the sea once typing pauses; a shared line (not typed) arrives settled.
  React.useEffect(() => {
    const svg = wave.current
    if (!svg) return
    svg.dataset.line = said
    if (!typed.current) {
      draw.current(false)
      return
    }
    const t = window.setTimeout(() => draw.current(true), 140)
    return () => clearTimeout(t)
  }, [said])

  return (
    <div className="sea">
      <Field className="sea-field" label="Your words" count maxLength={MAX}>
        <Input
          className="sea-input"
          value={line}
          autoComplete="off"
          spellCheck={false}
          placeholder={START}
          onChange={(e) => {
            typed.current = true
            setLine(e.target.value)
          }}
        />
      </Field>
      <figure className="sea-figure" aria-labelledby="sea-cap">
        <div className="sea-plate">
          <svg ref={wave} className="sea-wave" aria-hidden="true" preserveAspectRatio="xMinYMin meet" />
          <p className="sea-crest" style={{ "--cx": CREST.x, "--cy": CREST.y } as React.CSSProperties}>
            <span className="sea-crest-name">The crest</span>
            <span className="sea-crest-count">
              your line, set {times.toLocaleString("en")} times
            </span>
          </p>
        </div>
        <figcaption className="sea-cap" id="sea-cap">
          After Hokusai, about 1831 · set in {face} italic at 3 weights · no image file
        </figcaption>
      </figure>
      <div className="sea-foot">
        <p className="sea-weights">Heavier where the sea is darker: 400, 600, 900</p>
        <Button variant="bracket" aria-expanded={share.open} onClick={(e) => (share.open ? share.close() : share.show(e.currentTarget))}>
          Send your sea
        </Button>
      </div>
      <SharePlaces share={share} text={`My words, drawn as Hokusai's wave: “${said}”`} className="places-line sea-places" />
    </div>
  )
}
