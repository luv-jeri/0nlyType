// Sets the wordmark once, in a browser, and writes what it set to components/site/wordmark-set.ts:
//   npm run wordmark:set
// Run it again after changing the two faces, the creed, or the proportions below; the site only draws the result.
// "0nly" is sized by pretext to the measure of "Type.", which crosses its foot. Then "Type" is written: the italic is
// drawn, every band of it wide enough to hold a line is found, and pretext breaks the creed into lines exactly that
// wide. The edges and hairlines stay drawn, so the letters keep their outline. All in units where H is 100.
// The browser measures and finds the bands; the large letters are then written out as their outlines, read from the
// same font files with fontkit, so the logo never depends on a font arriving in time. Only the creed is live text.
import { chromium } from "playwright"
import { create } from "fontkit"
import { decompress } from "wawoff2"
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const OUT = "components/site/wordmark-set.ts"
const FONTS = "public/fonts"
const PRETEXT = "node_modules/@chenglou/pretext/dist"
const CREED = "a component library made of type and nothing else · every control, every sign and every ornament is set in words · two typefaces, one accent, a great deal of space · space does the layout, and type is the only ornament · "
const face = (prefix) => join(FONTS, readdirSync(FONTS).find((f) => f.startsWith(prefix)))

const page = `<!doctype html><style>
@font-face { font-family: Archivo; src: url(/archivo.woff2) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "Bodoni Moda"; src: url(/bodoni.woff2) format("woff2"); font-style: italic; font-weight: 400 900; }
</style>`

let browser
try { browser = await chromium.launch() } catch { browser = await chromium.launch({ channel: "chrome" }) }
try {
  const tab = await browser.newPage()
  await tab.route("http://wordmark.local/**", (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === "/") return route.fulfill({ contentType: "text/html", body: page })
    if (path === "/archivo.woff2") return route.fulfill({ contentType: "font/woff2", body: readFileSync(face("archivo-normal")) })
    if (path === "/bodoni.woff2") return route.fulfill({ contentType: "font/woff2", body: readFileSync(face("bodoni-moda-italic")) })
    return route.fulfill({ contentType: "text/javascript", body: readFileSync(join(PRETEXT, path)) })
  })
  await tab.goto("http://wordmark.local/")
  const set = await tab.evaluate(async (CREED) => {
    const { prepareWithSegments, layoutNextLine, measureNaturalWidth } = await import("/layout.js")
    await Promise.all(["900 extra-condensed 100px Archivo", "800 100px Archivo", "italic 400 100px 'Bodoni Moda'", "italic 700 100px 'Bodoni Moda'"].map((f) => document.fonts.load(f)))
    // Measured at four times the size the numbers are written at, and with a 2x raster, so rounding stays below a hair.
    const H = 400, K = 100 / H, DPR = 2
    const HEAVY = (s) => `900 extra-condensed ${s}px Archivo`, ZERO = (s) => `800 ${s}px Archivo`
    const ITAL = (s) => `italic 400 ${s}px "Bodoni Moda"`, SMALLI = (s) => `italic 700 ${s}px "Bodoni Moda"`
    const pen = document.createElement("canvas").getContext("2d")
    const W = (font, t, track = 0) => { pen.font = font; pen.letterSpacing = `${track}px`; return pen.measureText(t).width }

    const ts = H * 1.3, tw = measureNaturalWidth(prepareWithSegments("Type.", ITAL(ts)))
    const nlyAt = (s) => W(ZERO(s), "0") + 0.02 * s + W(HEAVY(s), "nly", -0.01 * s) - 0.03 * s
    const ns = (tw * 0.92) / (nlyAt(100) / 100)
    const w = tw + H * 0.3, base1 = ns * 0.74, base2 = base1 + ts * 0.5, h = base2 + ts * 0.32
    const ox = H * 0.12, zw = W(ZERO(ns), "0"), nx = ox + zw + 0.02 * ns, nw = W(HEAVY(ns), "nly", -0.01 * ns)
    const typeW = W(ITAL(ts), "Type")

    // The italic, rastered, and the bands of it that can hold a line.
    const fs = H * 0.034 * 0.78, lh = fs
    const c = document.createElement("canvas")
    c.width = Math.ceil(w * DPR); c.height = Math.ceil(h * DPR)
    const x = c.getContext("2d")
    x.scale(DPR, DPR); x.font = ITAL(ts); x.fillText("Type", 0, base2)
    const img = x.getImageData(0, 0, c.width, c.height).data, MW = c.width
    const inked = (px, py) => img[(py * MW + px) * 4 + 3] > 200
    const prepared = prepareWithSegments(CREED.repeat(12), SMALLI(fs))
    let cur = { segmentIndex: 0, graphemeIndex: 0 }
    const lines = []
    for (let y = 0; y + lh <= h; y += lh) {
      const y0 = Math.round(y * DPR), y1 = Math.round((y + lh) * DPR) - 1, ym = (y0 + y1) >> 1
      let run = -1
      for (let px = 0; px <= MW; px++) {
        const on = px < MW && inked(px, y0) && inked(px, y1) && inked(px, ym)
        if (on && run < 0) run = px
        if (!on && run >= 0) {
          const rx = run / DPR, rw = (px - run) / DPR
          run = -1
          if (rw < fs * 1.8) continue
          let line = layoutNextLine(prepared, cur, rw)
          if (!line) { cur = { segmentIndex: 0, graphemeIndex: 0 }; line = layoutNextLine(prepared, cur, rw) }
          if (!line) continue
          cur = line.end
          const t = line.text.replace(/^[\s·]+|[\s·]+$/g, "")
          // Justified as the poster sets it: by the word gaps, or, in a single word, by letter space up to 0.3 of the
          // size, so a short word in a wide band stays a word and does not spread into letters.
          const nat = W(SMALLI(fs), t), gaps = (t.match(/ /g) || []).length, n = [...t].length
          const fit = gaps ? rw : Math.min(rw, nat + fs * 0.3 * Math.max(0, n - 1))
          if (t) lines.push([rx, y, rw, t, fit])
        }
      }
    }
    const r = (v) => Math.round(v * K * 100) / 100
    return {
      w: r(w), h: r(h),
      nly: { s: r(ns), base: r(base1), zx: r(ox), zw: r(zw), nx: r(nx), nw: r(nw), dot: [r(ox + zw / 2), r(base1 - ns * 0.355), r(ns * 0.055)] },
      type: { s: r(ts), base: r(base2), w: r(typeW), rim: r(ts * 0.07) },
      fs: r(fs), lh: r(lh),
      lines: lines.map(([lx, ly, lw, t, fit]) => [r(lx), r(ly), r(lw), t, r(fit)]),
    }
  }, CREED)

  // The outlines, at the browser's instances: Archivo 800 for the zero, 900 at its narrowest width for "nly" (the
  // tracking the browser set, -0.01 of the size, after each letter), and Bodoni Moda italic 400 at the optical size
  // the browser picks for display sizes, 96. fontkit reads WOFF2 badly, so each face is unpacked to TrueType first.
  const ttf = async (prefix) => create(Buffer.from(await decompress(readFileSync(face(prefix)))))
  const archivo = await ttf("archivo-normal"), bodoni = await ttf("bodoni-moda-italic")
  const n2 = (v) => String(Math.round(v * 100) / 100)
  const ink = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  const outline = (font, text, size, x, base, track = 0) => {
    const k = size / font.unitsPerEm, run = font.layout(text)
    let pen = x, d = ""
    run.glyphs.forEach((g, i) => {
      const p = run.positions[i], gx = pen + p.xOffset * k, gy = base - p.yOffset * k
      for (const { command, args } of g.path.commands) {
        const pts = []
        for (let j = 0; j < args.length; j += 2) {
          const px = gx + args[j] * k, py = gy - args[j + 1] * k
          pts.push(n2(px), n2(py))
          ink.x0 = Math.min(ink.x0, px); ink.x1 = Math.max(ink.x1, px); ink.y0 = Math.min(ink.y0, py); ink.y1 = Math.max(ink.y1, py)
        }
        d += { moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" }[command] + pts.join(" ")
      }
      pen += p.xAdvance * k + track
    })
    return { d, end: pen }
  }
  const { nly, type } = set
  const zero = outline(archivo.getVariation({ wght: 800, wdth: 100 }), "0", nly.s, nly.zx, nly.base)
  const rest = outline(archivo.getVariation({ wght: 900, wdth: 62.5 }), "nly", nly.s, nly.nx, nly.base, -0.01 * nly.s)
  const ital = bodoni.getVariation({ wght: 400, opsz: 96 })
  const word = outline(ital, "Type", type.s, 0, type.base)
  const stop = outline(ital, ".", type.s, word.end, type.base)
  // The browser's measure and the outlines' must agree, or the bands would sit off the strokes they were found in.
  if (Math.abs(word.end - type.w) > 0.2) throw new Error(`"Type" is ${word.end} wide in its outline but ${type.w} in the browser`)
  set.paths = { nly: zero.d + rest.d, type: word.d, stop: stop.d }
  // The box the name is drawn in is its ink, so it sits flush wherever it is placed: [x, y, width, height].
  const fl = (v) => Math.floor(v * 100) / 100, ce = (v) => Math.ceil(v * 100) / 100
  set.box = [fl(ink.x0), fl(ink.y0), ce(ink.x1 - fl(ink.x0)), ce(ink.y1 - fl(ink.y0))]

  const head = `// Written by npm run wordmark:set (scripts/set-wordmark.mjs); run it again rather than editing this.
// In units where H is 100: "0nly" at size nly.s on its baseline, "Type" at type.s on its own, and the lines pretext
// broke the creed into for the bands of the italic wide enough to hold one: [x, top, width, text, set width], each
// band lh tall, the text spaced out to its set width. paths holds the outlines of "0nly", "Type" and its full stop,
// and box the rectangle their ink fills.
`
  writeFileSync(OUT, `${head}export const SET = ${JSON.stringify(set)} as const\n`)
  console.log(`${OUT}: ${set.lines.length} lines, the ink ${set.box[2]} x ${set.box[3]}, "Type" ${n2(set.box[1] + set.box[3] - set.type.base)} below its baseline`)
} finally {
  await browser.close()
}
